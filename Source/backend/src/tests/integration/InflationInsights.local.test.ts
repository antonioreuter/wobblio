import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool, type PoolClient } from 'pg';
import { ProductCatalogAdapter } from '@infrastructure/adapters/data-intelligence/ProductCatalogAdapter';
import { MerchantCatalogAdapter } from '@infrastructure/adapters/data-intelligence/MerchantCatalogAdapter';
import { PersonalInflationQueryAdapter } from '@infrastructure/adapters/data-intelligence/PersonalInflationQueryAdapter';
import { PersonalInflationSeriesQueryAdapter } from '@infrastructure/adapters/data-intelligence/PersonalInflationSeriesQueryAdapter';
import { RegionInflationQueryAdapter } from '@infrastructure/adapters/data-intelligence/RegionInflationQueryAdapter';
import { RegionInflationSeriesQueryAdapter } from '@infrastructure/adapters/data-intelligence/RegionInflationSeriesQueryAdapter';
import { SwitchingSavingsQueryAdapter } from '@infrastructure/adapters/data-intelligence/SwitchingSavingsQueryAdapter';
import { computeMatchedBasketInflation } from '@core/domain/personalInflation';
import { computeInflationSeries, mergeInflationSeries } from '@core/domain/inflationSeries';
import { computeSwitchingSavings } from '@core/domain/switchingSavings';

// Exercises the SQL behind `GET /me/insights/inflation` against real Postgres — the personal side
// (RLS-scoped invoice_line, under a restricted role) and the regional side (RLS-exempt
// price_observation), then composes the adapter outputs through the domain to assert the headline
// numbers the handler returns. Mirrors OwnPurchaseHistory/PriceTrendQuery harnesses: the personal
// reads run under a NOLOGIN role via SET LOCAL ROLE so the tenant policies are actually enforced.
const RLS_ROLE = 'wobblio_inflation_rls_test';
const uniqueEmbedding = (): number[] => Array.from({ length: 512 }, () => Math.random());
const DAY = 86_400_000;
const isoDay = (offsetDays: number): string =>
  new Date(Date.now() - offsetDays * DAY).toISOString().slice(0, 10);
const jsMedian = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
};

const WINDOW = 90;
const MONTHS = 6;
const SAVINGS_WINDOW = 365;
const CURRENT_DAY = 15; // inside the current window
const PRIOR_DAY = 120; // inside the prior window (and within a month bucket ~4 months back)

const tenantA = randomUUID();
const tenantB = randomUUID();
const region = `R-${randomUUID().slice(0, 8)}`;
const otherRegion = `R-${randomUUID().slice(0, 8)}`;

// Own purchases: pA/pB/pC bought in both windows (matched), pD current-only (unmatched → dropped).
const personalData: Record<string, { prior?: number[]; current?: number[] }> = {};
// Regional observations: pA/pB/pC clear k>=3 in both windows, pD is sparse (2 obs → gated out).
const regionData: Record<string, { prior?: number[]; current?: number[] }> = {};

describe('Inflation insights adapters — personal (RLS) + regional (price_observation) over Postgres', () => {
  let pool: Pool;
  let pA: string;
  let pB: string;
  let pC: string;
  let pD: string;
  let obsMerchant: string;

  const insertInvoice = async (tenantId: string, transactionDate: string): Promise<string> => {
    const res = await pool.query<{ id: string }>(
      `INSERT INTO invoice
         (tenant_id, uploaded_by_user_id, status, transaction_date, image_s3_key, image_sha256,
          location_country_code, location_region_code, location_status)
       VALUES ($1, $1, 'PARSED', $2, $3, $4, 'NL', $5, 'RESOLVED') RETURNING id`,
      [tenantId, transactionDate, `k-${randomUUID()}`, randomUUID().replace(/-/g, ''), region],
    );
    return res.rows[0].id;
  };

  const insertLine = (
    invoiceId: string,
    productId: string | null,
    lineTotal: number,
    over: { quantity?: number; isDiscount?: boolean; isDepositOrFee?: boolean } = {},
  ): Promise<unknown> =>
    pool.query(
      `INSERT INTO invoice_line
         (invoice_id, raw_text, product_id, quantity, line_total, is_discount, is_deposit_or_fee)
       VALUES ($1, 'line', $2, $3, $4, $5, $6)`,
      [invoiceId, productId, over.quantity ?? 1, lineTotal, over.isDiscount ?? false, over.isDepositOrFee ?? false],
    );

  const insertObs = (
    productId: string,
    regionCode: string,
    observedOn: string,
    packPrice: number,
    over: { quarantined?: boolean; wasDiscounted?: boolean } = {},
  ): Promise<unknown> =>
    pool.query(
      `INSERT INTO price_observation
         (product_id, merchant_id, country_code, region_code, observed_on, pack_price,
          normalized_unit_price, base_unit, currency, was_discounted, quality, quarantined,
          contributor_trust_at_write)
       VALUES ($1, $2, 'NL', $3, $4, $5, NULL, NULL, 'EUR', $6, 'AUTO', $7, 50)`,
      [productId, obsMerchant, regionCode, observedOn, packPrice, over.wasDiscounted ?? false, over.quarantined ?? false],
    );

  beforeAll(async () => {
    pool = new Pool({
      host: 'localhost', port: 5432, database: 'wobblio_local',
      user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 4,
    });

    await pool.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RLS_ROLE}') THEN
          DROP OWNED BY ${RLS_ROLE};
          DROP ROLE ${RLS_ROLE};
        END IF;
      END $$;
      CREATE ROLE ${RLS_ROLE} NOLOGIN;
      GRANT USAGE ON SCHEMA public TO ${RLS_ROLE};
      GRANT SELECT ON invoice, invoice_line, price_observation TO ${RLS_ROLE};
      GRANT EXECUTE ON FUNCTION current_tenant_household_ids() TO ${RLS_ROLE};
    `);

    await pool.query(
      `INSERT INTO app_user (id, cognito_sub, email, status) VALUES
         ($1, $3, 'infl-a@test.nl', 'ACTIVE'),
         ($2, $4, 'infl-b@test.nl', 'ACTIVE')`,
      [tenantA, tenantB, `sub-${tenantA}`, `sub-${tenantB}`],
    );

    const products = new ProductCatalogAdapter(pool);
    const mkProduct = () =>
      products.createProvisionalProduct({
        displayName: `Infl ${randomUUID().slice(0, 8)}`, brand: null, categoryId: 'cat-dairy',
        baseUnit: 'L', packSizeBaseUnits: 1, embedding: uniqueEmbedding(),
      });
    [pA, pB, pC, pD] = await Promise.all([mkProduct(), mkProduct(), mkProduct(), mkProduct()]);
    obsMerchant = await new MerchantCatalogAdapter(pool).createProvisionalMerchant(
      `Infl Shop ${randomUUID().slice(0, 8)}`, 'NL', 'cat-groceries',
    );

    personalData[pA] = { prior: [1.0], current: [1.05, 1.15] }; // median 1.10 vs 1.00 → 1.10
    personalData[pB] = { prior: [2.0], current: [2.2] };
    personalData[pC] = { prior: [3.0], current: [3.3] };
    personalData[pD] = { current: [9.0] }; // no prior → unmatched

    regionData[pA] = { prior: [1.2, 1.2, 1.2], current: [1.44, 1.44, 1.44] }; // 1.44/1.20 → 1.20
    regionData[pB] = { prior: [2.4, 2.4, 2.4], current: [2.88, 2.88, 2.88] };
    regionData[pC] = { prior: [3.6, 3.6, 3.6], current: [4.32, 4.32, 4.32] };
    regionData[pD] = { current: [5.0, 5.0] }; // only 2 obs → below k>=3

    // Personal side — tenantA current + prior invoices, plus excluded noise on the current one.
    const aCurrent = await insertInvoice(tenantA, isoDay(CURRENT_DAY));
    for (const [pid, d] of Object.entries(personalData)) {
      for (const v of d.current ?? []) await insertLine(aCurrent, pid, v);
    }
    await insertLine(aCurrent, pA, 0.5, { isDiscount: true }); // excluded (discount)
    await insertLine(aCurrent, pA, 9.99, { isDepositOrFee: true }); // excluded (deposit/fee)
    await insertLine(aCurrent, null, 5.0); // excluded (no product)

    const aPrior = await insertInvoice(tenantA, isoDay(PRIOR_DAY));
    for (const [pid, d] of Object.entries(personalData)) {
      for (const v of d.prior ?? []) await insertLine(aPrior, pid, v);
    }

    // tenantB bought pA once in the current window — must never surface for tenantA (RLS).
    const bCurrent = await insertInvoice(tenantB, isoDay(CURRENT_DAY));
    await insertLine(bCurrent, pA, 7.77);

    // Regional side — the target region.
    for (const [pid, d] of Object.entries(regionData)) {
      for (const v of d.current ?? []) await insertObs(pid, region, isoDay(CURRENT_DAY), v);
      for (const v of d.prior ?? []) await insertObs(pid, region, isoDay(PRIOR_DAY), v);
    }
    // Excluded regional noise: quarantined + discounted in-region, and a different region.
    await insertObs(pA, region, isoDay(CURRENT_DAY), 99, { quarantined: true });
    await insertObs(pA, region, isoDay(CURRENT_DAY), 88, { wasDiscounted: true });
    await insertObs(pA, otherRegion, isoDay(CURRENT_DAY), 1.0);
    await insertObs(pA, otherRegion, isoDay(PRIOR_DAY), 1.0);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM invoice_line WHERE invoice_id IN (SELECT id FROM invoice WHERE tenant_id = ANY($1))`, [[tenantA, tenantB]]);
    await pool.query(`DELETE FROM invoice WHERE tenant_id = ANY($1)`, [[tenantA, tenantB]]);
    await pool.query(`DELETE FROM price_observation WHERE region_code = ANY($1)`, [[region, otherRegion]]);
    await pool.query(`DELETE FROM product WHERE id = ANY($1)`, [[pA, pB, pC, pD]]);
    await pool.query(`DELETE FROM merchant WHERE id = $1`, [obsMerchant]);
    await pool.query(`DELETE FROM app_user WHERE id = ANY($1)`, [[tenantA, tenantB]]);
    await pool.query(`DROP OWNED BY ${RLS_ROLE}; DROP ROLE ${RLS_ROLE};`);
    await pool.end();
  });

  // Runs `fn` as the restricted RLS role with the given tenant's context — the only way the
  // invoice/invoice_line policies actually apply (the pool owner bypasses RLS).
  const asTenant = async <T>(tenantId: string, fn: (db: PoolClient) => Promise<T>): Promise<T> => {
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${RLS_ROLE}`);
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      return await fn(client);
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  };

  it('personal matched basket: median-of-medians per product, excluding noise and other tenants', async () => {
    const basket = await asTenant(tenantA, (db) =>
      new PersonalInflationQueryAdapter(db).matchedBasket({ windowDays: WINDOW }),
    );

    const byId = new Map(basket.map((r) => [r.productId, r]));
    expect(byId.has(pD)).toBe(false); // unmatched (current-only) product dropped
    expect(basket).toHaveLength(3);
    expect(byId.get(pA)!.currentMedian).toBeCloseTo(1.1, 4); // median(1.05, 1.15)
    expect(byId.get(pA)!.priorMedian).toBeCloseTo(1.0, 4); // discount/deposit lines excluded
    expect(byId.get(pB)!.currentMedian).toBeCloseTo(2.2, 4);
    expect(byId.get(pC)!.priorMedian).toBeCloseTo(3.0, 4);

    // Composed through the domain: three like ratios (1.10) → +10.0%.
    const result = computeMatchedBasketInflation(basket);
    expect(result.basketSize).toBe(3);
    expect(result.inflationPct).toBeCloseTo(10, 5);
  });

  it('personal matched basket is RLS-scoped: tenantB never sees tenantA rows', async () => {
    const basket = await asTenant(tenantB, (db) =>
      new PersonalInflationQueryAdapter(db).matchedBasket({ windowDays: WINDOW }),
    );
    // tenantB has only a single current-window pA line and no prior → nothing matches.
    expect(basket).toEqual([]);
  });

  it('personal monthly series: per-month medians for the caller, RLS-scoped', async () => {
    const rows = await asTenant(tenantA, (db) =>
      new PersonalInflationSeriesQueryAdapter(db).monthlyMedians({ months: MONTHS }),
    );
    const currentPeriod = isoDay(CURRENT_DAY).slice(0, 7);
    const priorPeriod = isoDay(PRIOR_DAY).slice(0, 7);
    const cell = (period: string, pid: string) =>
      rows.find((r) => r.period === period && r.productId === pid);

    expect(cell(currentPeriod, pA)!.median).toBeCloseTo(1.1, 4);
    expect(cell(priorPeriod, pA)!.median).toBeCloseTo(1.0, 4);
    expect(cell(currentPeriod, pB)!.median).toBeCloseTo(2.2, 4);
    // pD is present in the caller's series (no matched-basket gate here) but only current month.
    expect(cell(priorPeriod, pD)).toBeUndefined();
  });

  it('regional matched basket: k>=3 gate, quarantine/discount/region filters', async () => {
    const basket = await new RegionInflationQueryAdapter(pool).matchedBasket({ regionCode: region, windowDays: WINDOW });
    const byId = new Map(basket.map((r) => [r.productId, r]));

    expect(byId.has(pD)).toBe(false); // only 2 current obs → below quorum
    expect(basket).toHaveLength(3);
    expect(byId.get(pA)!.currentMedian).toBeCloseTo(1.44, 4); // 99 (quarantined) + 88 (discount) excluded
    expect(byId.get(pA)!.priorMedian).toBeCloseTo(1.2, 4);

    const result = computeMatchedBasketInflation(basket);
    expect(result.basketSize).toBe(3);
    expect(result.inflationPct).toBeCloseTo(20, 5); // 1.44/1.20 etc.
  });

  it('regional matched basket honors the region filter (other region invisible)', async () => {
    const basket = await new RegionInflationQueryAdapter(pool).matchedBasket({ regionCode: otherRegion, windowDays: WINDOW });
    // otherRegion has only 1 obs per window for pA → below quorum → nothing served.
    expect(basket).toEqual([]);
  });

  it('regional monthly series: per-month medians gated on k>=3', async () => {
    const rows = await new RegionInflationSeriesQueryAdapter(pool).monthlyMedians({ regionCode: region, months: MONTHS });
    const currentPeriod = isoDay(CURRENT_DAY).slice(0, 7);
    const cell = (period: string, pid: string) =>
      rows.find((r) => r.period === period && r.productId === pid);

    expect(cell(currentPeriod, pA)!.median).toBeCloseTo(1.44, 4);
    expect(cell(currentPeriod, pD)).toBeUndefined(); // 2 obs that month → gated out
  });

  it('switching savings: caller lines paired with the regional median, sub-quorum products dropped', async () => {
    const lines = await asTenant(tenantA, (db) =>
      new SwitchingSavingsQueryAdapter(db).savingsLines({ regionCode: region, windowDays: SAVINGS_WINDOW }),
    );

    // Every regular pA/pB/pC line pairs with its regional median; pD (sub-quorum region) and the
    // discount/deposit/null lines contribute nothing.
    const expectedLineCount =
      (personalData[pA].current!.length + personalData[pA].prior!.length) +
      (personalData[pB].current!.length + personalData[pB].prior!.length) +
      (personalData[pC].current!.length + personalData[pC].prior!.length);
    expect(lines).toHaveLength(expectedLineCount);

    const regionMedianA = jsMedian([...regionData[pA].prior!, ...regionData[pA].current!]);
    const pALines = lines.filter((l) => Math.abs(l.regionMedian - regionMedianA) < 1e-6);
    expect(pALines.length).toBe(3); // 2 current + 1 prior pA lines
    expect(pALines.every((l) => l.quantity === 1)).toBe(true);

    // No line references the region median of a sub-quorum product.
    const regionMedianD = jsMedian(regionData[pD].current!);
    expect(lines.some((l) => Math.abs(l.regionMedian - regionMedianD) < 1e-6)).toBe(false);

    const saved = computeSwitchingSavings(lines);
    expect(saved).not.toBeNull();
    expect(saved!).toBeGreaterThan(0);
  });

  it('composes a full 6-month personal-vs-region trend the way the handler does', async () => {
    const personalSeries = await asTenant(tenantA, (db) =>
      new PersonalInflationSeriesQueryAdapter(db).monthlyMedians({ months: MONTHS }),
    );
    const regionSeries = await new RegionInflationSeriesQueryAdapter(pool).monthlyMedians({ regionCode: region, months: MONTHS });

    const trend = mergeInflationSeries(
      computeInflationSeries(personalSeries),
      computeInflationSeries(regionSeries),
    );
    // Two seeded months → the axis spans them; the earliest is the 100-baseline for each side.
    const currentPeriod = isoDay(CURRENT_DAY).slice(0, 7);
    const priorPeriod = isoDay(PRIOR_DAY).slice(0, 7);
    const periods = trend.map((t) => t.period);
    expect(periods).toContain(currentPeriod);
    expect(periods).toContain(priorPeriod);
    // The baseline month indexes to 100 on both lines (3 matched products each).
    const base = trend.find((t) => t.period === priorPeriod)!;
    expect(base.personalIndexPct).toBeCloseTo(100, 5);
    expect(base.regionIndexPct).toBeCloseTo(100, 5);
  });
});
