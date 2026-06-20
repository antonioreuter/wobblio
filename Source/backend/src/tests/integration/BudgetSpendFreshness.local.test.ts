import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';

// Locks in three behaviours behind live budget consumption:
//  - a quorum/location-held invoice (location_status PENDING) still counts;
//  - spend is windowed on the invoice issue date (transaction_date);
//  - list_active_budgets_for_invoice surfaces the uploader's + the household
//    owner's budgets so the ingestion worker can fire alerts cross-tenant.
const owner = randomUUID();
const member = randomUUID();
const householdId = randomUUID();

const personalSpend = async (pool: Pool, from: string, to: string): Promise<number> => {
  const { rows } = await pool.query<{ spend: string }>(
    `SELECT compute_budget_spend($1, 'TOTAL', NULL, NULL, $2, $3)::text AS spend`,
    [member, from, to],
  );
  return parseFloat(rows[0].spend);
};

const seedInvoice = (
  pool: Pool,
  uploadedBy: string,
  householdRef: string | null,
  transactionDate: string,
  total: number,
  locationStatus: string,
): Promise<unknown> =>
  pool.query(
    `INSERT INTO invoice
       (tenant_id, household_id, uploaded_by_user_id, status, transaction_date,
        total, image_s3_key, image_sha256, location_status)
     VALUES ($1, $2, $1, 'PARSED', $3, $4, $5, $6, $7)`,
    [uploadedBy, householdRef, transactionDate, total, `k-${randomUUID()}`, randomUUID().replace(/-/g, ''), locationStatus],
  );

describe('budget spend freshness, issue-date window, and per-invoice budget lookup (Postgres)', () => {
  let pool: Pool;
  let householdInvoiceId: string;

  beforeAll(async () => {
    pool = new Pool({
      host: 'localhost', port: 5432, database: 'wobblio_local',
      user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 2,
    });

    await pool.query(
      `INSERT INTO app_user (id, cognito_sub, email, status) VALUES
         ($1, $3, 'bf-owner@test.nl', 'ACTIVE'),
         ($2, $4, 'bf-member@test.nl', 'ACTIVE')`,
      [owner, member, `sub-${owner}`, `sub-${member}`],
    );
    await pool.query(`INSERT INTO household (id, owner_user_id, name) VALUES ($1, $2, 'Freshness HH')`, [householdId, owner]);
    await pool.query(
      `INSERT INTO household_member (household_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [householdId, owner, member],
    );

    // Member's personal receipts, all PARSED + location PENDING ("waiting for quorum"):
    //  - 40 on 2026-06-15 (inside June + inside the single day)
    //  - 25 on 2026-06-10 (inside June, outside the single day)
    await seedInvoice(pool, member, null, '2026-06-15', 40, 'PENDING');
    await seedInvoice(pool, member, null, '2026-06-10', 25, 'PENDING');

    // A household-space receipt by the member (tenant_id = member, so it also lands in
    // the member's personal TOTAL) — issue-dated in May so it stays out of the June and
    // single-day windows below; used only for the per-invoice budget lookup.
    const res = await pool.query<{ id: string }>(
      `INSERT INTO invoice
         (tenant_id, household_id, uploaded_by_user_id, status, transaction_date,
          total, image_s3_key, image_sha256, location_status)
       VALUES ($1, $2, $1, 'PARSED', '2026-05-20', 12, $3, $4, 'PENDING') RETURNING id`,
      [member, householdId, `k-${randomUUID()}`, randomUUID().replace(/-/g, '')],
    );
    householdInvoiceId = res.rows[0].id;

    // A personal budget for the member and a HOUSEHOLD budget owned by the owner.
    await pool.query(
      `INSERT INTO budget (id, tenant_id, scope, amount, period) VALUES
         ($1, $2, 'TOTAL', 200, 'MONTH'),
         ($3, $4, 'HOUSEHOLD', 500, 'MONTH')`,
      [randomUUID(), member, randomUUID(), owner],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM budget WHERE tenant_id = ANY($1)`, [[owner, member]]);
    await pool.query(`DELETE FROM invoice WHERE uploaded_by_user_id = ANY($1)`, [[owner, member]]);
    await pool.query(`DELETE FROM household_member WHERE household_id = $1`, [householdId]);
    await pool.query(`DELETE FROM household WHERE id = $1`, [householdId]);
    await pool.query(`DELETE FROM app_user WHERE id = ANY($1)`, [[owner, member]]);
    await pool.end();
  });

  it('counts a quorum/location-held PENDING invoice toward personal spend', async () => {
    // Whole of June: both personal receipts (40 + 25), both PENDING, are included.
    expect(await personalSpend(pool, '2026-06-01', '2026-07-01')).toBe(65);
  });

  it('windows spend on the invoice issue date (single-day budget)', async () => {
    // Only the 2026-06-15 receipt falls inside the one-day window.
    expect(await personalSpend(pool, '2026-06-15', '2026-06-16')).toBe(40);
    // A day with no receipt issue-dated to it sees nothing.
    expect(await personalSpend(pool, '2026-06-14', '2026-06-15')).toBe(0);
  });

  it('list_active_budgets_for_invoice returns the uploader and household-owner budgets', async () => {
    const { rows } = await pool.query<{ tenant_id: string; scope: string }>(
      `SELECT tenant_id, scope FROM list_active_budgets_for_invoice($1) ORDER BY scope::text`,
      [householdInvoiceId],
    );
    expect(rows).toEqual([
      { tenant_id: owner, scope: 'HOUSEHOLD' },
      { tenant_id: member, scope: 'TOTAL' },
    ]);
  });
});
