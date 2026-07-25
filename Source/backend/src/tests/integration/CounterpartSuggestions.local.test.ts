import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { MerchantCatalogAdapter } from '@infrastructure/adapters/data-intelligence/MerchantCatalogAdapter';
import { ProductCatalogAdapter } from '@infrastructure/adapters/data-intelligence/ProductCatalogAdapter';
import { PriceObservationStoreAdapter } from '@infrastructure/adapters/data-intelligence/PriceObservationStoreAdapter';
import { CounterpartCandidateQueryAdapter } from '@infrastructure/adapters/comparison/CounterpartCandidateQueryAdapter';
import { CounterpartSuggestionService } from '@core/services/comparison/CounterpartSuggestionService';
import type { PriceObservationInput } from '@core/domain/priceObservation';

const DAY = 86_400_000;
const isoDay = (offsetDays: number): string => new Date(Date.now() - offsetDays * DAY).toISOString().slice(0, 10);

// Deterministic embeddings: a one-hot on `axis`. Cosine of two same-axis vectors is 1 (well above the
// 0.75 floor); two different axes is 0 (well below) — no reliance on random-vector luck.
const axisEmbedding = (axis: number): number[] => {
  const v = Array<number>(512).fill(0);
  v[axis] = 1;
  return v;
};

// The adapter joins the caller's RLS-scoped product_link; assertions run as a non-owner RLS role so
// link visibility is proven, not bypassed.
const RLS_ROLE = 'wobblio_counterpart_rls_test';

describe('CounterpartCandidateQueryAdapter — trend suggestions over Postgres', () => {
  let pool: Pool;
  const tenant = randomUUID();
  const region = `R-${randomUUID().slice(0, 8)}`;
  const otherRegion = `R-${randomUUID().slice(0, 8)}`;
  let anchorId: string;
  let similarId: string; // same name/embedding, tracked in region → suggested
  let dismissedId: string; // same name/embedding but DISMISSED link → excluded
  let otherRegionId: string; // similar but tracked only in otherRegion → excluded
  let linkedId: string; // dissimilar name/embedding but ACCEPTED link → suggested first
  const createdMerchants: string[] = [];
  const createdProducts: string[] = [];

  const emit = (rows: PriceObservationInput[]) => new PriceObservationStoreAdapter(pool).emit(rows);
  const obs = (productId: string, merchantId: string, regionCode: string): PriceObservationInput => ({
    productId, merchantId, countryCode: 'NL', regionCode, observedOn: isoDay(0),
    packPrice: 1.5, currency: 'EUR', wasDiscounted: false, quality: 'AUTO', quarantined: false, contributorTrustAtWrite: 50,
  });

  const makeProduct = async (name: string, merchantName: string, embedding: number[]): Promise<{ productId: string; merchantId: string }> => {
    const merchantId = await new MerchantCatalogAdapter(pool).createProvisionalMerchant(merchantName, 'NL', 'cat-groceries');
    const productId = await new ProductCatalogAdapter(pool).createProvisionalProduct({
      displayName: name, brand: null, categoryId: 'cat-dairy', countryCode: 'NL', merchantId, baseUnit: 'L', packSizeBaseUnits: 1, embedding,
    });
    await pool.query(`UPDATE product SET status = 'ACTIVE' WHERE id = $1`, [productId]);
    createdMerchants.push(merchantId);
    createdProducts.push(productId);
    return { productId, merchantId };
  };

  // Inserts a canonical product_link (owner connection, bypasses RLS) for the test tenant.
  const link = async (a: string, b: string, status: 'ACCEPTED' | 'DISMISSED'): Promise<void> => {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    await pool.query(
      `INSERT INTO product_link (tenant_id, product_a_id, product_b_id, status, source)
       VALUES ($1, $2, $3, $4, 'USER_TAP')`,
      [tenant, lo, hi, status],
    );
  };

  const suggestAsTenant = async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${RLS_ROLE}`);
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenant]);
      const svc = new CounterpartSuggestionService(new CounterpartCandidateQueryAdapter(client));
      const out = await svc.suggest(anchorId, 'NL', region);
      await client.query('COMMIT');
      return out;
    } finally {
      client.release();
    }
  };

  beforeAll(async () => {
    pool = new Pool({ host: 'localhost', port: 5432, database: 'wobblio_local', user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 4 });

    await pool.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RLS_ROLE}') THEN
          DROP OWNED BY ${RLS_ROLE}; DROP ROLE ${RLS_ROLE};
        END IF;
      END $$;
      CREATE ROLE ${RLS_ROLE} NOLOGIN;
      GRANT USAGE ON SCHEMA public TO ${RLS_ROLE};
      GRANT SELECT ON product, merchant, price_observation, product_link TO ${RLS_ROLE};
    `);
    await pool.query(`INSERT INTO app_user (id, cognito_sub, email, status) VALUES ($1, $2, 'cpt@test.nl', 'ACTIVE')`, [tenant, `sub-${tenant}`]);

    ({ productId: anchorId } = await makeProduct('Suggest Halfvolle Melk', 'Cpt Anchor Shop', axisEmbedding(0)));
    ({ productId: similarId } = await makeProduct('Suggest Halfvolle Melk', 'Cpt Similar Shop', axisEmbedding(0)));
    ({ productId: dismissedId } = await makeProduct('Suggest Halfvolle Melk', 'Cpt Dismissed Shop', axisEmbedding(0)));
    ({ productId: otherRegionId } = await makeProduct('Suggest Halfvolle Melk', 'Cpt OtherRegion Shop', axisEmbedding(0)));
    ({ productId: linkedId } = await makeProduct('Zzz Unrelated Product Name', 'Cpt Linked Shop', axisEmbedding(1)));

    await emit([
      obs(similarId, createdMerchants[1], region),
      obs(dismissedId, createdMerchants[2], region),
      obs(otherRegionId, createdMerchants[3], otherRegion),
      obs(linkedId, createdMerchants[4], region),
    ]);

    await link(anchorId, dismissedId, 'DISMISSED');
    await link(anchorId, linkedId, 'ACCEPTED');
  });

  afterAll(async () => {
    await pool.query('DELETE FROM product_link WHERE tenant_id = $1', [tenant]);
    await pool.query('DELETE FROM price_observation WHERE region_code = ANY($1)', [[region, otherRegion]]);
    await pool.query('DELETE FROM product WHERE id = ANY($1)', [createdProducts]);
    await pool.query('DELETE FROM merchant WHERE id = ANY($1)', [createdMerchants]);
    await pool.query('DELETE FROM app_user WHERE id = $1', [tenant]);
    await pool.query(`DROP OWNED BY ${RLS_ROLE}; DROP ROLE ${RLS_ROLE};`);
    await pool.end();
  });

  it('suggests same-category cross-merchant counterparts tracked in the region', async () => {
    const ids = (await suggestAsTenant()).map((s) => s.productId);
    expect(ids).toContain(similarId);
  });

  it('excludes a dismissed pair and a counterpart tracked only in another region', async () => {
    const ids = (await suggestAsTenant()).map((s) => s.productId);
    expect(ids).not.toContain(dismissedId);
    expect(ids).not.toContain(otherRegionId);
  });

  it('surfaces an accepted link first and flags it, even below the similarity floor', async () => {
    const out = await suggestAsTenant();
    expect(out[0].productId).toBe(linkedId);
    expect(out[0].linked).toBe(true);
  });
});
