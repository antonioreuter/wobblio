import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { ProductLinkRepositoryAdapter } from '@infrastructure/adapters/comparison/ProductLinkRepositoryAdapter';
import { ProductLinkService } from '@core/services/comparison/ProductLinkService';
import { ProductCatalogAdapter } from '@infrastructure/adapters/data-intelligence/ProductCatalogAdapter';

const uniqueEmbedding = (): number[] => Array.from({ length: 512 }, () => Math.random());

// product_link is RLS-scoped (invariant #1). Assertions run under a restricted NOLOGIN role via
// SET LOCAL ROLE — the object owner would bypass RLS, so isolation must be proven as a non-owner.
const RLS_ROLE = 'wobblio_product_link_rls_test';

describe('Product links — RLS + upsert (Postgres)', () => {
  let pool: Pool;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  let prodHigh: string;
  let prodLow: string;

  const asTenant = async <T>(tenantId: string, fn: (svc: ProductLinkService) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${RLS_ROLE}`);
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      const result = await fn(new ProductLinkService(new ProductLinkRepositoryAdapter(client)));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  };

  // Reads the canonical row directly (owner connection, bypasses RLS) to assert stored state.
  const readLink = async (tenantId: string) => {
    const [a, b] = prodLow < prodHigh ? [prodLow, prodHigh] : [prodHigh, prodLow];
    const result = await pool.query<{ status: string; size_equivalent: boolean }>(
      `SELECT status, size_equivalent FROM product_link
       WHERE tenant_id = $1 AND product_a_id = $2 AND product_b_id = $3`,
      [tenantId, a, b],
    );
    return result.rows[0] ?? null;
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
      GRANT SELECT, INSERT, UPDATE, DELETE ON product_link TO ${RLS_ROLE};
      GRANT SELECT ON product, merchant TO ${RLS_ROLE};
    `);

    await pool.query(
      `INSERT INTO app_user (id, cognito_sub, email, status) VALUES
         ($1, $3, 'link-a@test.nl', 'ACTIVE'), ($2, $4, 'link-b@test.nl', 'ACTIVE')`,
      [tenantA, tenantB, `sub-${tenantA}`, `sub-${tenantB}`],
    );

    const catalog = new ProductCatalogAdapter(pool);
    prodHigh = await catalog.createProvisionalProduct({ displayName: `Link Milk ${randomUUID().slice(0, 8)}`, brand: null, categoryId: 'cat-dairy', countryCode: 'NL', merchantId: null, baseUnit: 'L', packSizeBaseUnits: 1, embedding: uniqueEmbedding() });
    prodLow = await catalog.createProvisionalProduct({ displayName: `Link Milk ${randomUUID().slice(0, 8)}`, brand: null, categoryId: 'cat-dairy', countryCode: 'NL', merchantId: null, baseUnit: 'L', packSizeBaseUnits: 2, embedding: uniqueEmbedding() });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM product_link WHERE tenant_id = ANY($1)`, [[tenantA, tenantB]]);
    await pool.query(`DELETE FROM product WHERE id = ANY($1)`, [[prodHigh, prodLow]]);
    await pool.query(`DELETE FROM app_user WHERE id = ANY($1)`, [[tenantA, tenantB]]);
    await pool.query(`DROP OWNED BY ${RLS_ROLE}; DROP ROLE ${RLS_ROLE};`);
    await pool.end();
  });

  it('accepts a pair in either argument order into one canonical row', async () => {
    await asTenant(tenantA, (svc) => svc.setStatus(prodHigh, prodLow, 'ACCEPTED'));
    const link = await readLink(tenantA);
    expect(link?.status).toBe('ACCEPTED');
    expect(link?.size_equivalent).toBe(false);

    // A second accept in the reverse order is idempotent — still one row, still ACCEPTED.
    await asTenant(tenantA, (svc) => svc.setStatus(prodLow, prodHigh, 'ACCEPTED'));
    const count = await pool.query('SELECT count(*)::int AS n FROM product_link WHERE tenant_id = $1', [tenantA]);
    expect(count.rows[0].n).toBe(1);
  });

  it('confirms same-size on the accepted pair', async () => {
    await asTenant(tenantA, (svc) => svc.setSizeEquivalent(prodLow, prodHigh, true));
    expect((await readLink(tenantA))?.size_equivalent).toBe(true);
  });

  it('lists the accepted pair via acceptedLinksAmong (both endpoints selected)', async () => {
    const links = await asTenant(tenantA, (svc) => svc.linksAmong([prodLow, prodHigh]));
    expect(links).toHaveLength(1);
    expect(links[0].sizeEquivalent).toBe(true);
    // A single-product query yields nothing (a link needs two selected products).
    expect(await asTenant(tenantA, (svc) => svc.linksAmong([prodLow]))).toHaveLength(0);
  });

  it('dismissing updates the existing row status (ON CONFLICT)', async () => {
    await asTenant(tenantA, (svc) => svc.setStatus(prodHigh, prodLow, 'DISMISSED'));
    expect((await readLink(tenantA))?.status).toBe('DISMISSED');
  });

  it('rejects a size-confirm on a dismissed pair (only ACCEPTED pairs are confirmable)', async () => {
    // The pair is DISMISSED from the previous test but size_equivalent is still true from the earlier
    // accept-confirm. A size-confirm must match no row (status <> ACCEPTED), throw, and leave it as-is.
    await expect(asTenant(tenantA, (svc) => svc.setSizeEquivalent(prodHigh, prodLow, false))).rejects.toThrow();
    expect((await readLink(tenantA))?.size_equivalent).toBe(true);
  });

  it('isolates links per tenant (RLS): tenant B cannot see or update tenant A’s link', async () => {
    // B has no link yet → a size-equivalent toggle finds no row and is rejected (RLS hides A's row).
    await expect(asTenant(tenantB, (svc) => svc.setSizeEquivalent(prodHigh, prodLow, true))).rejects.toThrow();
    expect(await readLink(tenantB)).toBeNull();
    // A's link is untouched by B's attempt.
    expect((await readLink(tenantA))?.status).toBe('DISMISSED');
  });
});
