import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool, type PoolClient } from 'pg';
import { ProductCatalogAdapter } from '@infrastructure/adapters/data-intelligence/ProductCatalogAdapter';
import { OwnPurchaseHistoryQueryAdapter } from '@infrastructure/adapters/data-intelligence/OwnPurchaseHistoryQueryAdapter';

// The own-purchase history feeds a tenant's pre-quorum comparison view, so it MUST be
// RLS-scoped to the caller. Locally everything connects as the table-owner (RLS bypassed),
// so the read assertions run under a restricted NOLOGIN role via SET LOCAL ROLE — the only
// way to actually exercise the invoice/invoice_line tenant policies.
const RLS_ROLE = 'wobblio_own_history_rls_test';
const uniqueEmbedding = (): number[] => Array.from({ length: 512 }, () => Math.random());
const DAY = 86_400_000;
const isoDay = (offsetDays: number): string =>
  new Date(Date.now() - offsetDays * DAY).toISOString().slice(0, 10);

const tenantA = randomUUID();
const tenantB = randomUUID();
const region = `R-${randomUUID().slice(0, 8)}`;
const otherRegion = `R-${randomUUID().slice(0, 8)}`;

describe('OwnPurchaseHistoryQueryAdapter — RLS-scoped own price history (Postgres)', () => {
  let pool: Pool;
  let milkId: string; // bought several times across two weeks
  let nicheId: string; // bought once — below public quorum, must still be served
  let pendingId: string; // bought only on receipts still pending location review

  const insertInvoice = async (
    tenantId: string,
    transactionDate: string,
    regionCode: string | null,
    loc: { countryCode?: string | null; status?: string } = {},
  ): Promise<string> => {
    const res = await pool.query<{ id: string }>(
      `INSERT INTO invoice
         (tenant_id, uploaded_by_user_id, status, transaction_date, image_s3_key, image_sha256,
          location_country_code, location_region_code, location_status)
       VALUES ($1, $1, 'PARSED', $2, $3, $4, $6, $5, $7) RETURNING id`,
      [
        tenantId, transactionDate, `k-${randomUUID()}`, randomUUID().replace(/-/g, ''), regionCode,
        loc.countryCode === undefined ? 'NL' : loc.countryCode,
        loc.status ?? 'RESOLVED',
      ],
    );
    return res.rows[0].id;
  };

  const insertLine = (
    invoiceId: string,
    productId: string | null,
    normalizedUnitPrice: number | null,
    over: { isDiscount?: boolean; isDepositOrFee?: boolean } = {},
  ): Promise<unknown> =>
    pool.query(
      `INSERT INTO invoice_line
         (invoice_id, raw_text, product_id, normalized_unit_price, line_total, is_discount, is_deposit_or_fee)
       VALUES ($1, 'line', $2, $3, $4, $5, $6)`,
      [invoiceId, productId, normalizedUnitPrice, normalizedUnitPrice ?? 0, over.isDiscount ?? false, over.isDepositOrFee ?? false],
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
      GRANT SELECT ON invoice, invoice_line TO ${RLS_ROLE};
      GRANT EXECUTE ON FUNCTION current_tenant_household_ids() TO ${RLS_ROLE};
    `);

    await pool.query(
      `INSERT INTO app_user (id, cognito_sub, email, status) VALUES
         ($1, $3, 'oh-a@test.nl', 'ACTIVE'),
         ($2, $4, 'oh-b@test.nl', 'ACTIVE')`,
      [tenantA, tenantB, `sub-${tenantA}`, `sub-${tenantB}`],
    );

    const products = new ProductCatalogAdapter(pool);
    milkId = await products.createProvisionalProduct({
      displayName: `Own Milk ${randomUUID().slice(0, 8)}`, brand: null, categoryId: 'cat-dairy',
      baseUnit: 'L', packSizeBaseUnits: 1, embedding: uniqueEmbedding(),
    });
    nicheId = await products.createProvisionalProduct({
      displayName: `Own Niche ${randomUUID().slice(0, 8)}`, brand: null, categoryId: 'cat-dairy',
      baseUnit: 'L', packSizeBaseUnits: 1, embedding: uniqueEmbedding(),
    });
    pendingId = await products.createProvisionalProduct({
      displayName: `Own Pending ${randomUUID().slice(0, 8)}`, brand: null, categoryId: 'cat-dairy',
      baseUnit: 'L', packSizeBaseUnits: 1, embedding: uniqueEmbedding(),
    });

    // tenantA, week W1 (today), region R: milk 1.00 + 1.40 (median 1.20), one promo at 0.80,
    // a deposit line (excluded) and an unmatched product_id=NULL line (excluded). Plus a
    // single niche purchase at 3.00 (below quorum — must still be served).
    const w1 = await insertInvoice(tenantA, isoDay(0), region);
    await insertLine(w1, milkId, 1.0);
    await insertLine(w1, milkId, 1.4);
    await insertLine(w1, milkId, 0.8, { isDiscount: true });
    await insertLine(w1, milkId, 9.99, { isDepositOrFee: true });
    await insertLine(w1, null, 5.0);
    await insertLine(w1, nicheId, 3.0);

    // tenantA, week W2 (a week earlier), region R: milk 1.50, no promo.
    const w2 = await insertInvoice(tenantA, isoDay(7), region);
    await insertLine(w2, milkId, 1.5);

    // tenantA, different region — excluded by the region filter.
    const otherR = await insertInvoice(tenantA, isoDay(0), otherRegion);
    await insertLine(otherR, milkId, 8.88);

    // tenantB, same region + product — must be invisible to tenantA (RLS).
    const bInv = await insertInvoice(tenantB, isoDay(0), region);
    await insertLine(bInv, milkId, 7.77);

    // tenantA, location still PENDING review (region NULL, country known NL): served regardless
    // of the picker region — it's the user's own upload. 2.00 in week W1.
    const pendNL = await insertInvoice(tenantA, isoDay(0), null, { status: 'PENDING' });
    await insertLine(pendNL, pendingId, 2.0);

    // tenantA, PENDING with a DIFFERENT known country (BE): excluded from an NL view.
    const pendBE = await insertInvoice(tenantA, isoDay(0), null, { countryCode: 'BE', status: 'PENDING' });
    await insertLine(pendBE, pendingId, 9.0);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM invoice_line WHERE invoice_id IN (SELECT id FROM invoice WHERE tenant_id = ANY($1))`, [[tenantA, tenantB]]);
    await pool.query(`DELETE FROM invoice WHERE tenant_id = ANY($1)`, [[tenantA, tenantB]]);
    await pool.query(`DELETE FROM price_observation WHERE product_id = ANY($1)`, [[milkId, nicheId, pendingId]]);
    await pool.query(`DELETE FROM product WHERE id = ANY($1)`, [[milkId, nicheId, pendingId]]);
    await pool.query(`DELETE FROM app_user WHERE id = ANY($1)`, [[tenantA, tenantB]]);
    await pool.query(`DROP OWNED BY ${RLS_ROLE}; DROP ROLE ${RLS_ROLE};`);
    await pool.end();
  });

  const asTenant = async <T>(tenantId: string, fn: (a: OwnPurchaseHistoryQueryAdapter) => Promise<T>): Promise<T> => {
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${RLS_ROLE}`);
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      return await fn(new OwnPurchaseHistoryQueryAdapter(client));
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  };

  it('serves weekly medians for own purchases, splitting promos, with no quorum gate', async () => {
    const lines = await asTenant(tenantA, (a) =>
      a.history({ productIds: [milkId, nicheId], countryCode: 'NL', regionCode: region, weeks: 26 }),
    );

    const milk = lines.find((l) => l.productId === milkId)!;
    expect(milk.purchaseCount).toBe(4); // 1.00 + 1.40 + 0.80 + 1.50; deposit/null/other-region excluded
    const w1 = milk.points.find((p) => p.median !== null && Math.abs(p.median - 1.2) < 0.001)!;
    expect(w1.median).toBeCloseTo(1.2, 4);
    expect(w1.discountMedian).toBeCloseTo(0.8, 4); // promo is a distinct signal
    const w2 = milk.points.find((p) => p.median !== null && Math.abs(p.median - 1.5) < 0.001)!;
    expect(w2.median).toBeCloseTo(1.5, 4);
    expect(w2.discountMedian).toBeNull();

    // A single-purchase product is served despite never reaching public quorum — the fix.
    const niche = lines.find((l) => l.productId === nicheId)!;
    expect(niche.purchaseCount).toBe(1);
    expect(niche.points[0].median).toBeCloseTo(3.0, 4);
  });

  it('serves own purchases from receipts still pending location review, country-scoped', async () => {
    const lines = await asTenant(tenantA, (a) =>
      a.history({ productIds: [pendingId], countryCode: 'NL', regionCode: region, weeks: 26 }),
    );
    // The NL-pending receipt (region NULL) is served despite the picker region; the BE-pending
    // receipt is excluded as a different known country.
    expect(lines).toHaveLength(1);
    const pending = lines[0];
    expect(pending.productId).toBe(pendingId);
    expect(pending.purchaseCount).toBe(1);
    expect(pending.points[0].median).toBeCloseTo(2.0, 4);
  });

  it('never leaks another tenant\'s purchases (RLS) and honors the region filter', async () => {
    const lines = await asTenant(tenantB, (a) =>
      a.history({ productIds: [milkId, nicheId], countryCode: 'NL', regionCode: region, weeks: 26 }),
    );
    // tenantB only bought milk once at 7.77 in this region; tenantA's rows are invisible.
    expect(lines).toHaveLength(1);
    const milk = lines[0];
    expect(milk.productId).toBe(milkId);
    expect(milk.purchaseCount).toBe(1);
    expect(milk.points[0].median).toBeCloseTo(7.77, 4);
  });
});
