import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';

// Credit conservation across §6.3 transitions is a SQL-level property of the two
// SECURITY DEFINER carry-over functions (copy on activate, GREATEST on settle). These
// run as the table owner, so the assertions seed/read quota_counter directly (RLS
// bypassed) and drive the functions through their public signatures.
//
// Requires the local stack migrated (`npm run migrate:up`) so the functions exist.
const WEEK = '2026-06-22';
const owner = randomUUID();
const member = randomUUID();
const householdId = randomUUID();

describe('household credit carry-over — Postgres SD functions', () => {
  let pool: Pool;

  const setUsed = (tenantId: string, counter: string, used: number) =>
    pool.query(
      `INSERT INTO quota_counter (tenant_id, counter, week_start, used)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, counter, week_start) DO UPDATE SET used = $4`,
      [tenantId, counter, WEEK, used],
    );

  const getUsed = async (tenantId: string, counter: string): Promise<number | null> => {
    const r = await pool.query<{ used: string }>(
      `SELECT used::text AS used FROM quota_counter
       WHERE tenant_id = $1 AND counter = $2 AND week_start = $3`,
      [tenantId, counter, WEEK],
    );
    return r.rows[0] ? parseInt(r.rows[0].used, 10) : null;
  };

  beforeAll(async () => {
    pool = new Pool({
      host: 'localhost', port: 5432, database: 'wobblio_local',
      user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 2,
    });
    await pool.query(
      `INSERT INTO app_user (id, cognito_sub, email, status) VALUES
         ($1, $3, 'co-owner@test.nl', 'ACTIVE'),
         ($2, $4, 'co-member@test.nl', 'ACTIVE')`,
      [owner, member, `sub-${owner}`, `sub-${member}`],
    );
    await pool.query(`INSERT INTO household (id, owner_user_id, name) VALUES ($1, $2, 'Carry HH')`, [householdId, owner]);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM quota_counter WHERE tenant_id = ANY($1)`, [[owner, member, householdId]]);
    await pool.query(`DELETE FROM household WHERE id = $1`, [householdId]);
    await pool.query(`DELETE FROM app_user WHERE id = ANY($1)`, [[owner, member]]);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM quota_counter WHERE tenant_id = ANY($1)`, [[owner, member, householdId]]);
  });

  describe('carry_over_household_pool_on_activate', () => {
    it("seeds the pool from the owner's spend, leaving the member's personal untouched", async () => {
      await setUsed(owner, 'CREDITS', 50000);
      await setUsed(member, 'CREDITS', 20000);

      await pool.query(`SELECT carry_over_household_pool_on_activate($1, $2)`, [householdId, WEEK]);

      expect(await getUsed(householdId, 'HOUSEHOLD_CREDITS')).toBe(50000);
      expect(await getUsed(member, 'CREDITS')).toBe(20000);
      expect(await getUsed(owner, 'CREDITS')).toBe(50000); // copied, not moved
    });

    it('overwrites a stale pool row on re-activation', async () => {
      await setUsed(owner, 'CREDITS', 50000);
      await setUsed(householdId, 'HOUSEHOLD_CREDITS', 90000);

      await pool.query(`SELECT carry_over_household_pool_on_activate($1, $2)`, [householdId, WEEK]);

      expect(await getUsed(householdId, 'HOUSEHOLD_CREDITS')).toBe(50000);
    });

    it('seeds 0 when the owner has consumed nothing', async () => {
      await pool.query(`SELECT carry_over_household_pool_on_activate($1, $2)`, [householdId, WEEK]);
      expect(await getUsed(householdId, 'HOUSEHOLD_CREDITS')).toBe(0);
    });
  });

  describe('settle_household_pool_to_owner', () => {
    it('absorbs pool spend into the owner when the pool is the larger', async () => {
      await setUsed(owner, 'CREDITS', 50000);
      await setUsed(householdId, 'HOUSEHOLD_CREDITS', 80000);

      await pool.query(`SELECT settle_household_pool_to_owner($1, $2)`, [householdId, WEEK]);

      expect(await getUsed(owner, 'CREDITS')).toBe(80000);
    });

    it("keeps the owner's own spend when it exceeds the pool (GREATEST)", async () => {
      await setUsed(owner, 'CREDITS', 50000);
      await setUsed(householdId, 'HOUSEHOLD_CREDITS', 30000);

      await pool.query(`SELECT settle_household_pool_to_owner($1, $2)`, [householdId, WEEK]);

      expect(await getUsed(owner, 'CREDITS')).toBe(50000);
    });
  });

  it('conserves consumed credits across activate → pool spend → settle', async () => {
    await setUsed(owner, 'CREDITS', 50000);

    // Pool activates and inherits the owner's 50k.
    await pool.query(`SELECT carry_over_household_pool_on_activate($1, $2)`, [householdId, WEEK]);
    // Pooled uploads spend another 30k against the shared counter.
    await pool.query(
      `UPDATE quota_counter SET used = used + 30000
       WHERE tenant_id = $1 AND counter = 'HOUSEHOLD_CREDITS' AND week_start = $2`,
      [householdId, WEEK],
    );
    // Pool dissolves; the owner re-absorbs the full 80k of consumption.
    await pool.query(`SELECT settle_household_pool_to_owner($1, $2)`, [householdId, WEEK]);

    expect(await getUsed(owner, 'CREDITS')).toBe(80000); // 50k personal + 30k in-pool, none lost
  });
});
