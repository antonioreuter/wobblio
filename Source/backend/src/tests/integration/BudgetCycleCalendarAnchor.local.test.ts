import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool, type PoolClient } from 'pg';
import { BudgetRepositoryAdapter } from '@infrastructure/adapters/budgets/BudgetRepositoryAdapter';
import { periodStart, periodEnd } from '@core/domain/budget';

// Regression lock for the recurring "uploaded invoices not computed in the budget"
// defect: a budget created mid-period used to anchor cycle_start to the creation day,
// so the live window [cycle_start, cycle_start + period) silently dropped every
// receipt issue-dated earlier in the same period. The fix anchors cycle_start to the
// calendar period start; this test proves the window now spans the whole period.
const tenant = randomUUID();
const TODAY = '2026-06-24'; // a Wednesday in June

const seedInvoice = (pool: Pool, transactionDate: string, total: number): Promise<unknown> =>
  pool.query(
    `INSERT INTO invoice
       (tenant_id, household_id, uploaded_by_user_id, status, transaction_date,
        total, image_s3_key, image_sha256)
     VALUES ($1, NULL, $1, 'PARSED', $2, $3, $4, $5)`,
    [tenant, transactionDate, total, `k-${randomUUID()}`, randomUUID().replace(/-/g, '')],
  );

const spendOver = async (pool: Pool, from: string, to: string): Promise<number> => {
  const { rows } = await pool.query<{ spend: string }>(
    `SELECT compute_budget_spend($1, 'TOTAL', NULL, NULL, $2, $3)::text AS spend`,
    [tenant, from, to],
  );
  return parseFloat(rows[0].spend);
};

describe('budget cycle anchored to the calendar period (Postgres)', () => {
  let pool: Pool;
  let client: PoolClient;

  beforeAll(async () => {
    pool = new Pool({
      host: 'localhost', port: 5432, database: 'wobblio_local',
      user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 2,
    });
    client = await pool.connect();

    await pool.query(
      `INSERT INTO app_user (id, cognito_sub, email, status) VALUES ($1, $2, 'anchor@test.nl', 'ACTIVE')`,
      [tenant, `sub-${tenant}`],
    );
    // Two receipts earlier in June (before TODAY) + one in May (previous period).
    await seedInvoice(pool, '2026-06-05', 50);
    await seedInvoice(pool, '2026-06-20', 30);
    await seedInvoice(pool, '2026-05-28', 15);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM budget WHERE tenant_id = $1`, [tenant]);
    await pool.query(`DELETE FROM invoice WHERE tenant_id = $1`, [tenant]);
    await pool.query(`DELETE FROM app_user WHERE id = $1`, [tenant]);
    client.release();
    await pool.end();
  });

  it('persists a MONTH budget anchored to the first of the month', async () => {
    const cycleStart = periodStart(TODAY, 'MONTH');
    expect(cycleStart).toBe('2026-06-01');

    const id = await new BudgetRepositoryAdapter(client).create({
      tenantId: tenant, scope: 'TOTAL', categoryId: null, memberUserId: null,
      amount: 200, period: 'MONTH', cycleStart,
    });

    const { rows } = await pool.query<{ cycle_start: string }>(
      `SELECT cycle_start::text AS cycle_start FROM budget WHERE id = $1`,
      [id],
    );
    expect(rows[0].cycle_start).toBe('2026-06-01');
  });

  it('counts receipts dated earlier in the month over the anchored window', async () => {
    const cycleStart = periodStart(TODAY, 'MONTH'); // 2026-06-01
    const to = periodEnd(cycleStart, 'MONTH'); // 2026-07-01
    // 50 (Jun 05) + 30 (Jun 20); the May 28 receipt is in the previous period.
    expect(await spendOver(pool, cycleStart, to)).toBe(80);
  });

  it('regression: the old creation-day window dropped those same receipts', async () => {
    // Pre-fix anchor: cycle_start = creation day (TODAY) → [2026-06-24, 2026-07-24).
    expect(await spendOver(pool, TODAY, periodEnd(TODAY, 'MONTH'))).toBe(0);
  });
});
