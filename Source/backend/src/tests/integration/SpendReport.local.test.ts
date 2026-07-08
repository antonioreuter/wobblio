import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { SpendReportQueryAdapter } from '@infrastructure/adapters/reporting/SpendReportQueryAdapter';
import type { SpendReportFilter } from '@core/ports/reporting/ISpendReportQuery';

// Exercises the real SQL of SpendReportQueryAdapter against Postgres. Seeding runs as the
// owner (wobblio_dev); reads run as the RLS-bound runtime role (wobblio_app) with the tenant
// context set, so scoping comes from the invoice RLS policy the aggregation always joins.
// Locks in: reconciled sums tie parent→child at every level and tie the grand total to
// invoice.total (pro-rata distribution of the printed total across lines), home-currency FX
// conversion, signed discounts, region filtering (incl. pending-location country match),
// and L4 product grouping with occurrences. Invoices A–E are seeded with total = Σ lines so
// reconciliation is the identity there; invoice F seeds total ≠ Σ lines to prove the pro-rata.
const tenant = randomUUID();
const jumbo = randomUUID();
const albert = randomUUID();
const milk = randomUUID();
const cheese = randomUUID();

const ALL_REGIONS: SpendReportFilter = { from: '2026-06-01', to: '2026-08-01', country: '', region: '' };
const NL_NB: SpendReportFilter = { from: '2026-06-01', to: '2026-08-01', country: 'NL', region: 'NL-NB' };

describe('SpendReportQueryAdapter (Postgres, line-rooted)', () => {
  let seedPool: Pool;
  let appPool: Pool;

  const scoped = async <T>(fn: (adapter: SpendReportQueryAdapter) => Promise<T>): Promise<T> => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenant]);
      const result = await fn(new SpendReportQueryAdapter(client, 'EUR'));
      await client.query('ROLLBACK');
      return result;
    } finally {
      client.release();
    }
  };

  beforeAll(async () => {
    seedPool = new Pool({ host: 'localhost', port: 5432, database: 'wobblio_local', user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 2 });
    appPool = new Pool({ host: 'localhost', port: 5432, database: 'wobblio_local', user: 'wobblio_app', password: 'wobblio_app_secret', max: 2 });

    await seedPool.query(`INSERT INTO app_user (id, cognito_sub, email, status) VALUES ($1, $2, 'spendrep@test.nl', 'ACTIVE')`, [tenant, `sub-${tenant}`]);
    // Unique brand names to avoid the (brand_name, country_code) uniqueness of seeded merchants.
    await seedPool.query(
      `INSERT INTO merchant (id, brand_name, country_code, status) VALUES ($1, $3, 'NL', 'ACTIVE'), ($2, $4, 'NL', 'ACTIVE')`,
      [jumbo, albert, `SpendRep-Jumbo-${jumbo}`, `SpendRep-Albert-${albert}`],
    );
    await seedPool.query(
      `INSERT INTO product (id, category_id, display_name, base_unit, status) VALUES
         ($1, 'cat-dairy', 'Milk 1L', 'L', 'ACTIVE'),
         ($2, 'cat-cheese', 'Gouda 500g', 'KG', 'ACTIVE')`,
      [milk, cheese],
    );

    // `total` is the receipt's printed grand total (invoice currency). For A–E it equals the
    // Σ of the invoice's lines, so the pro-rata reconciliation is the identity; F differs on
    // purpose (see below) to exercise the distribution.
    const invoice = async (
      merchantId: string, date: string, currency: string, fx: number | null,
      status: string, country: string | null, region: string | null, total: number,
    ): Promise<string> => {
      const res = await seedPool.query<{ id: string }>(
        `INSERT INTO invoice
           (tenant_id, uploaded_by_user_id, merchant_id, status, transaction_date, currency,
            total, total_home_currency, fx_rate_used, image_s3_key, image_sha256,
            location_status, location_country_code, location_region_code)
         VALUES ($1, $1, $2, 'PARSED', $3, $4, $11, NULL, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [tenant, merchantId, date, currency, fx, `k-${randomUUID()}`, randomUUID().replace(/-/g, ''), status, country, region, total],
      );
      return res.rows[0].id;
    };
    const line = (
      invoiceId: string, productId: string | null, categoryId: string | null,
      quantity: number, lineTotal: number, isDiscount = false,
    ): Promise<unknown> =>
      seedPool.query(
        `INSERT INTO invoice_line (invoice_id, raw_text, product_id, category_id, quantity, line_total, is_discount)
         VALUES ($1, 'line', $2, $3, $4, $5, $6)`,
        [invoiceId, productId, categoryId, quantity, lineTotal, isDiscount],
      );

    // A — Jumbo, EUR, NL-NB resolved (total = Σ lines = 11.0)
    const a = await invoice(jumbo, '2026-07-01', 'EUR', null, 'RESOLVED', 'NL', 'NL-NB', 11.0);
    await line(a, milk, 'cat-dairy', 2, 3.0);
    await line(a, milk, 'cat-dairy', 1, 1.5);
    await line(a, null, 'cat-produce', 1, 2.0);
    await line(a, null, 'cat-groceries-discount', 1, -0.5, true);
    await line(a, null, 'cat-electronics', 1, 5.0);
    // B — Albert, EUR, NL-NB resolved (cheese + an uncategorized line; total = 5.0)
    const b = await invoice(albert, '2026-07-02', 'EUR', null, 'RESOLVED', 'NL', 'NL-NB', 5.0);
    await line(b, cheese, 'cat-cheese', 1, 4.0);
    await line(b, null, null, 1, 1.0);
    // C — Jumbo, USD @0.90, US-CA resolved (foreign region; total 2.00 → 1.80 home)
    const c = await invoice(jumbo, '2026-07-03', 'USD', 0.9, 'RESOLVED', 'US', 'US-CA', 2.0);
    await line(c, milk, 'cat-dairy', 1, 2.0);
    // D — Jumbo, EUR, PENDING location, country NL (region unknown; total = 1.0)
    const d = await invoice(jumbo, '2026-07-04', 'EUR', null, 'PENDING', 'NL', null, 1.0);
    await line(d, milk, 'cat-dairy', 1, 1.0);
    // E — Jumbo, GBP with NO fx rate (rate missing at ingestion): unconvertible foreign money.
    // Must be EXCLUDED, never summed at face value into the EUR home report (fix: FX conversion).
    const e = await invoice(jumbo, '2026-07-05', 'GBP', null, 'RESOLVED', 'NL', 'NL-NB', 99.0);
    await line(e, milk, 'cat-dairy', 1, 99.0);
    // F — Jumbo, EUR, NL-NB resolved. Printed total 12.0 but the itemized lines sum to only 10.0
    // (e.g. a 2.00 deposit/rounding not itemized). Reconciliation scales the lines by 12/10 = 1.2,
    // so cat-transport reports 12.0, not the raw 10.0. Isolated in cat-transport so it doesn't
    // perturb the groceries/electronics/uncategorized assertions above.
    const f = await invoice(jumbo, '2026-07-06', 'EUR', null, 'RESOLVED', 'NL', 'NL-NB', 12.0);
    await line(f, null, 'cat-transport', 1, 6.0);
    await line(f, null, 'cat-transport', 1, 4.0);
    // G — degenerate: lines net to 0 (a product fully offset by a discount) but total is 5.0. The
    // receipt can't be distributed pro-rata (0 denominator), so it must fall back to face value —
    // never a NULL/NaN amount. cat-health nets to 0. Isolated so it doesn't touch other assertions.
    const g = await invoice(jumbo, '2026-07-07', 'EUR', null, 'RESOLVED', 'NL', 'NL-NB', 5.0);
    await line(g, null, 'cat-health', 1, 5.0);
    await line(g, null, 'cat-health', 1, -5.0, true);
    // H — parse contradiction: line sum is negative (-3.0) but the printed total is positive (5.0).
    // sign(sum) ≠ sign(total), so the factor 5/-3 would sign-flip the line to +5; the guard falls
    // back to face value instead → cat-pet reports -3.0, not +5.0.
    const h = await invoice(jumbo, '2026-07-08', 'EUR', null, 'RESOLVED', 'NL', 'NL-NB', 5.0);
    await line(h, null, 'cat-pet', 1, -3.0);
  });

  afterAll(async () => {
    await seedPool.query(`DELETE FROM invoice_line WHERE invoice_id IN (SELECT id FROM invoice WHERE tenant_id = $1)`, [tenant]);
    await seedPool.query(`DELETE FROM invoice WHERE tenant_id = $1`, [tenant]);
    await seedPool.query(`DELETE FROM product WHERE id = ANY($1)`, [[milk, cheese]]);
    await seedPool.query(`DELETE FROM merchant WHERE id = ANY($1)`, [[jumbo, albert]]);
    await seedPool.query(`DELETE FROM app_user WHERE id = $1`, [tenant]);
    await seedPool.end();
    await appPool.end();
  });

  const amountOf = (rows: { amount: number }[], pick: (r: any) => boolean) => rows.find(pick)?.amount;

  it('L1 categories: line-rooted macro sums in home currency, incl. uncategorized', async () => {
    const rows = await scoped((a) => a.categories(ALL_REGIONS));
    // groceries = A(3+1.5+2-0.5) + B cheese(4) + C(1.8) + D(1) = 12.8
    expect(amountOf(rows, (r) => r.macroId === 'cat-groceries')).toBeCloseTo(12.8, 5);
    expect(amountOf(rows, (r) => r.macroId === 'cat-electronics')).toBeCloseTo(5.0, 5);
    expect(amountOf(rows, (r) => r.macroId === null)).toBeCloseTo(1.0, 5); // B's uncategorized line
  });

  it('L2 merchants under groceries reconcile to the L1 groceries total', async () => {
    const rows = await scoped((a) => a.merchants('cat-groceries', ALL_REGIONS));
    expect(amountOf(rows, (r) => r.merchantId === jumbo)).toBeCloseTo(8.8, 5); // 6.0 + 1.8 + 1.0
    expect(amountOf(rows, (r) => r.merchantId === albert)).toBeCloseTo(4.0, 5);
    const jumboRow = rows.find((r) => r.merchantId === jumbo)!;
    expect(jumboRow.invoiceCount).toBe(3); // A, C, D
  });

  it('L3 item-categories at Jumbo reconcile to the L2 Jumbo total (signed discount)', async () => {
    const rows = await scoped((a) => a.itemCategories('cat-groceries', jumbo, ALL_REGIONS));
    expect(amountOf(rows, (r) => r.categoryId === 'cat-dairy')).toBeCloseTo(7.3, 5); // 4.5 + 1.8 + 1.0
    expect(amountOf(rows, (r) => r.categoryId === 'cat-produce')).toBeCloseTo(2.0, 5);
    expect(amountOf(rows, (r) => r.categoryId === 'cat-groceries-discount')).toBeCloseTo(-0.5, 5);
  });

  it('L4 items group by product with per-trip occurrences', async () => {
    const rows = await scoped((a) => a.items(jumbo, 'cat-dairy', ALL_REGIONS));
    const milkRow = rows.find((r) => r.name === 'Milk 1L')!;
    expect(milkRow.amount).toBeCloseTo(7.3, 5);
    expect(milkRow.quantity).toBeCloseTo(5, 5); // 2 + 1 + 1 + 1
    expect(milkRow.occurrences).toHaveLength(4);
  });

  it('product view: item-categories with a null merchant aggregate across all stores', async () => {
    // merchant = null drops the store filter, so groceries subcategories span Jumbo AND Albert —
    // Albert's cheese (4.0) now appears alongside Jumbo's dairy (7.3), unlike the per-merchant L3.
    const rows = await scoped((a) => a.itemCategories('cat-groceries', null, ALL_REGIONS));
    expect(amountOf(rows, (r) => r.categoryId === 'cat-dairy')).toBeCloseTo(7.3, 5); // Jumbo only
    expect(amountOf(rows, (r) => r.categoryId === 'cat-cheese')).toBeCloseTo(4.0, 5); // Albert only
    expect(amountOf(rows, (r) => r.categoryId === 'cat-produce')).toBeCloseTo(2.0, 5);
  });

  it('product view: items with a null merchant carry the store name on each occurrence', async () => {
    const rows = await scoped((a) => a.items(null, 'cat-cheese', ALL_REGIONS));
    const gouda = rows.find((r) => r.name === 'Gouda 500g')!;
    expect(gouda.amount).toBeCloseTo(4.0, 5);
    expect(gouda.occurrences).toHaveLength(1);
    expect(gouda.occurrences[0].merchantName).toBe(`SpendRep-Albert-${albert}`);
  });

  it('distributes the printed grand total across lines pro-rata (total ≠ Σ lines)', async () => {
    // Invoice F: lines sum to 10.0 but the printed total is 12.0. Every level must report the
    // reconciled 12.0, not the raw 10.0, and the children must still sum to the parent.
    const cats = await scoped((a) => a.categories(ALL_REGIONS));
    expect(amountOf(cats, (r) => r.macroId === 'cat-transport')).toBeCloseTo(12.0, 5);

    const merchants = await scoped((a) => a.merchants('cat-transport', ALL_REGIONS));
    expect(amountOf(merchants, (r) => r.merchantId === jumbo)).toBeCloseTo(12.0, 5);

    // Both F lines share the seed raw_text so they collapse into one L4 group; its amount is the
    // reconciled 12.0 (raw 6.0 → 7.2 plus raw 4.0 → 4.8, each scaled by 1.2).
    const items = await scoped((a) => a.items(jumbo, 'cat-transport', ALL_REGIONS));
    const total = items.reduce((acc, r) => acc + r.amount, 0);
    expect(total).toBeCloseTo(12.0, 5);
  });

  it('falls back to face value when the itemization is degenerate (zero or sign-flipped)', async () => {
    const cats = await scoped((a) => a.categories(ALL_REGIONS));
    // G: lines +5.0 and -5.0 net to 0 with total 5.0 → undistributable → face value, sums to 0.0
    // (a real number, not NULL/NaN), never the dropped/NaN it would be under a bare NULLIF divide.
    const health = amountOf(cats, (r) => r.macroId === 'cat-health');
    expect(health).not.toBeNaN();
    expect(health).toBeCloseTo(0.0, 5);
    // H: line -3.0 with total +5.0 (opposite sign) → guard falls back to face value -3.0, NOT the
    // sign-flipped +5.0 the raw factor (5/-3) would have produced.
    expect(amountOf(cats, (r) => r.macroId === 'cat-pet')).toBeCloseTo(-3.0, 5);
  });

  it('excludes foreign invoices whose FX rate was missing (never summed at face value)', async () => {
    // Invoice E is 99.00 GBP with fx_rate_used NULL; if it were summed at face value it would
    // dominate the EUR report. All the totals above already assume it's absent — assert it here too.
    const cats = await scoped((a) => a.categories(ALL_REGIONS));
    expect(amountOf(cats, (r) => r.macroId === 'cat-groceries')).toBeCloseTo(12.8, 5);
    const items = await scoped((a) => a.items(jumbo, 'cat-dairy', ALL_REGIONS));
    expect(items.find((r) => r.name === 'Milk 1L')?.occurrences).toHaveLength(4);
  });

  it('region filter scopes to NL-NB but keeps pending-location NL receipts', async () => {
    const rows = await scoped((a) => a.categories(NL_NB));
    // Excludes C (US-CA resolved); keeps A, B (NL-NB) and D (pending, country NL).
    expect(amountOf(rows, (r) => r.macroId === 'cat-groceries')).toBeCloseTo(11.0, 5); // 6.0 + 4.0 + 1.0
  });
});
