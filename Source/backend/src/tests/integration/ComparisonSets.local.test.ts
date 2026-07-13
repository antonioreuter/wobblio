import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { ComparisonSetRepositoryAdapter } from '@infrastructure/adapters/comparison/ComparisonSetRepositoryAdapter';
import { ComparisonSetService } from '@core/services/comparison/ComparisonSetService';
import { ProductCatalogAdapter } from '@infrastructure/adapters/data-intelligence/ProductCatalogAdapter';

const uniqueEmbedding = (): number[] => Array.from({ length: 512 }, () => Math.random());

// Comparison sets are RLS-scoped (invariant #1). Assertions run under a restricted NOLOGIN role via
// SET LOCAL ROLE — the object owner would bypass RLS, so isolation must be proven as a non-owner.
const RLS_ROLE = 'wobblio_comparison_rls_test';

describe('Comparison sets — RLS + CRUD (Postgres)', () => {
  let pool: Pool;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  let prodA1: string;
  let prodA2: string;

  // Runs fn inside a tx as the RLS role with the given tenant context (mirrors withTenantTx).
  const asTenant = async <T>(tenantId: string, fn: (repo: ComparisonSetRepositoryAdapter) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${RLS_ROLE}`);
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      const result = await fn(new ComparisonSetRepositoryAdapter(client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  };

  beforeAll(async () => {
    pool = new Pool({ host: 'localhost', port: 5432, database: 'wobblio_local', user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 4 });

    await pool.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RLS_ROLE}') THEN
          DROP OWNED BY ${RLS_ROLE};
          DROP ROLE ${RLS_ROLE};
        END IF;
      END $$;
      CREATE ROLE ${RLS_ROLE} NOLOGIN;
      GRANT USAGE ON SCHEMA public TO ${RLS_ROLE};
      GRANT SELECT, INSERT, UPDATE, DELETE ON product_comparison_set, product_comparison_set_member TO ${RLS_ROLE};
      GRANT SELECT ON product, merchant TO ${RLS_ROLE};
    `);

    await pool.query(
      `INSERT INTO app_user (id, cognito_sub, email, status) VALUES
         ($1, $3, 'cmp-a@test.nl', 'ACTIVE'), ($2, $4, 'cmp-b@test.nl', 'ACTIVE')`,
      [tenantA, tenantB, `sub-${tenantA}`, `sub-${tenantB}`],
    );

    const catalog = new ProductCatalogAdapter(pool);
    prodA1 = await catalog.createProvisionalProduct({ displayName: `Cmp Milk ${randomUUID().slice(0, 8)}`, brand: null, categoryId: 'cat-dairy', countryCode: 'NL', merchantId: null, baseUnit: 'L', packSizeBaseUnits: 1, embedding: uniqueEmbedding() });
    prodA2 = await catalog.createProvisionalProduct({ displayName: `Cmp Milk ${randomUUID().slice(0, 8)}`, brand: null, categoryId: 'cat-dairy', countryCode: 'NL', merchantId: null, baseUnit: 'L', packSizeBaseUnits: 2, embedding: uniqueEmbedding() });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM product_comparison_set WHERE tenant_id = ANY($1)`, [[tenantA, tenantB]]);
    await pool.query(`DELETE FROM product WHERE id = ANY($1)`, [[prodA1, prodA2]]);
    await pool.query(`DELETE FROM app_user WHERE id = ANY($1)`, [[tenantA, tenantB]]);
    await pool.query(`DROP OWNED BY ${RLS_ROLE}; DROP ROLE ${RLS_ROLE};`);
    await pool.end();
  });

  it('creates a set, adds members, and reads them back with product/merchant/size metadata', async () => {
    const setId = await asTenant(tenantA, (repo) => new ComparisonSetService(repo).create('milk'));
    await asTenant(tenantA, (repo) => new ComparisonSetService(repo).addMember(setId, prodA1, false));
    await asTenant(tenantA, (repo) => new ComparisonSetService(repo).addMember(setId, prodA2, true));

    const sets = await asTenant(tenantA, (repo) => new ComparisonSetService(repo).list());
    const set = sets.find((s) => s.id === setId)!;
    expect(set.name).toBe('milk');
    expect(set.members).toHaveLength(2);
    const m2 = set.members.find((m) => m.productId === prodA2)!;
    expect(m2.sizeEquivalent).toBe(true);
    expect(m2.source).toBe('USER');
    expect(m2.size.sizeText).toBe('2L');
    expect(m2.size.sizeSource).toBe('RECEIPT');
  });

  it('caps membership at 5 and rejects a duplicate product', async () => {
    const setId = await asTenant(tenantA, (repo) => new ComparisonSetService(repo).create(null));
    await asTenant(tenantA, (repo) => new ComparisonSetService(repo).addMember(setId, prodA1, false));
    // Duplicate product → 400 path.
    await expect(asTenant(tenantA, (repo) => new ComparisonSetService(repo).addMember(setId, prodA1, false))).rejects.toThrow();
  });

  it('isolates sets per tenant (RLS): tenant B cannot see or mutate tenant A’s set', async () => {
    const setId = await asTenant(tenantA, (repo) => new ComparisonSetService(repo).create('a-only'));

    const bSets = await asTenant(tenantB, (repo) => new ComparisonSetService(repo).list());
    expect(bSets.some((s) => s.id === setId)).toBe(false);

    // B cannot rename A's set (RLS hides the row → 0 rows affected → 404).
    await expect(asTenant(tenantB, (repo) => new ComparisonSetService(repo).rename(setId, 'hijack'))).rejects.toThrow();
    // A still sees its own set unchanged.
    const aSets = await asTenant(tenantA, (repo) => new ComparisonSetService(repo).list());
    expect(aSets.find((s) => s.id === setId)?.name).toBe('a-only');
  });

  it('toggles size_equivalent and removes members/sets', async () => {
    const svc = (repo: ComparisonSetRepositoryAdapter) => new ComparisonSetService(repo);
    const setId = await asTenant(tenantA, (r) => svc(r).create('togglable'));
    const memberId = await asTenant(tenantA, (r) => svc(r).addMember(setId, prodA1, false));

    await asTenant(tenantA, (r) => svc(r).setSizeEquivalent(setId, memberId, true));
    let set = await asTenant(tenantA, (r) => svc(r).get(setId));
    expect(set.members[0].sizeEquivalent).toBe(true);

    await asTenant(tenantA, (r) => svc(r).removeMember(setId, memberId));
    set = await asTenant(tenantA, (r) => svc(r).get(setId));
    expect(set.members).toHaveLength(0);

    await asTenant(tenantA, (r) => svc(r).remove(setId));
    await expect(asTenant(tenantA, (r) => svc(r).get(setId))).rejects.toThrow();
  });
});
