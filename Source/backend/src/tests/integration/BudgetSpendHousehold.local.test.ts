import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';

// compute_budget_spend is SECURITY DEFINER and takes an explicit p_tenant_id, so it
// is exercised directly (no RLS role dance). HOUSEHOLD scope must sum EVERY member's
// household-space invoices for the owner's households, optionally filtered by category,
// while leaving the owner's personal (household_id NULL) spend out.
const owner = randomUUID();
const member = randomUUID();
const householdId = randomUUID();

const GROCERIES = 'cat-budget-spend-test-groceries';
const OTHER = 'cat-budget-spend-test-other';

const FROM = '2026-06-01';
const TO = '2026-07-01';
const WHEN = '2026-06-15';

const spend = async (
  pool: Pool,
  scope: 'TOTAL' | 'HOUSEHOLD',
  categoryId: string | null,
): Promise<number> => {
  const { rows } = await pool.query<{ spend: string }>(
    `SELECT compute_budget_spend($1, $2, $3, NULL, $4, $5)::text AS spend`,
    [owner, scope, categoryId, FROM, TO],
  );
  return parseFloat(rows[0].spend);
};

const seedInvoice = (
  pool: Pool,
  uploadedBy: string,
  householdRef: string | null,
  categoryId: string,
  total: number,
): Promise<unknown> =>
  pool.query(
    `INSERT INTO invoice
       (tenant_id, household_id, uploaded_by_user_id, status, transaction_date,
        total, category_id, image_s3_key, image_sha256)
     VALUES ($1, $2, $1, 'PARSED', $3, $4, $5, $6, $7)`,
    [uploadedBy, householdRef, WHEN, total, categoryId, `k-${randomUUID()}`, randomUUID().replace(/-/g, '')],
  );

describe('compute_budget_spend — HOUSEHOLD scope (Postgres)', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({
      host: 'localhost', port: 5432, database: 'wobblio_local',
      user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 2,
    });

    await pool.query(
      `INSERT INTO app_user (id, cognito_sub, email, status) VALUES
         ($1, $3, 'bs-owner@test.nl', 'ACTIVE'),
         ($2, $4, 'bs-member@test.nl', 'ACTIVE')`,
      [owner, member, `sub-${owner}`, `sub-${member}`],
    );
    await pool.query(`INSERT INTO household (id, owner_user_id, name) VALUES ($1, $2, 'Spend HH')`, [householdId, owner]);
    await pool.query(
      `INSERT INTO household_member (household_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [householdId, owner, member],
    );
    await pool.query(
      `INSERT INTO product_category (id, parent_id, name, level) VALUES ($1, NULL, 'Test Groceries', 1), ($2, NULL, 'Test Other', 1)`,
      [GROCERIES, OTHER],
    );

    // Owner's household grocery receipt (30) + member's household other receipt (20):
    // both must land in the household total. The owner's personal grocery receipt (100,
    // household_id NULL) must NOT.
    await seedInvoice(pool, owner, householdId, GROCERIES, 30);
    await seedInvoice(pool, member, householdId, OTHER, 20);
    await seedInvoice(pool, owner, null, GROCERIES, 100);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM invoice WHERE uploaded_by_user_id = ANY($1)`, [[owner, member]]);
    await pool.query(`DELETE FROM household_member WHERE household_id = $1`, [householdId]);
    await pool.query(`DELETE FROM household WHERE id = $1`, [householdId]);
    await pool.query(`DELETE FROM product_category WHERE id = ANY($1)`, [[GROCERIES, OTHER]]);
    await pool.query(`DELETE FROM app_user WHERE id = ANY($1)`, [[owner, member]]);
    await pool.end();
  });

  it('sums every member household-space invoice (excludes the owner personal receipt)', async () => {
    expect(await spend(pool, 'HOUSEHOLD', null)).toBe(50);
  });

  it('honours the optional category filter across members', async () => {
    expect(await spend(pool, 'HOUSEHOLD', GROCERIES)).toBe(30);
    expect(await spend(pool, 'HOUSEHOLD', OTHER)).toBe(20);
  });

  it('keeps TOTAL personal-only (owner own invoices, not the member upload)', async () => {
    // Owner's own invoices: household grocery (30) + personal grocery (100) = 130.
    expect(await spend(pool, 'TOTAL', null)).toBe(130);
  });
});
