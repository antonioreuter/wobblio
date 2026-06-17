import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool, type PoolClient } from 'pg';
import { HouseholdRepositoryAdapter } from '@infrastructure/adapters/households/HouseholdRepositoryAdapter';

// Locally everything connects as the superuser/table-owner role, which bypasses RLS.
// To actually exercise the tenant-isolation policies, the read assertions run under a
// restricted NOLOGIN role (no superuser, no BYPASSRLS) via SET LOCAL ROLE.
const RLS_ROLE = 'wobblio_membership_rls_test';

const owner = randomUUID();
const member = randomUUID();
const outsider = randomUUID();
const householdId = randomUUID();

describe('HouseholdRepositoryAdapter.findMembershipForUser — Postgres + RLS', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({
      host: 'localhost', port: 5432, database: 'wobblio_local',
      user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 2,
    });

    // Restricted role that does not bypass RLS, with just enough to run the query.
    await pool.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RLS_ROLE}') THEN
          DROP OWNED BY ${RLS_ROLE};
          DROP ROLE ${RLS_ROLE};
        END IF;
      END $$;
      CREATE ROLE ${RLS_ROLE} NOLOGIN;
      GRANT USAGE ON SCHEMA public TO ${RLS_ROLE};
      GRANT SELECT ON household, household_member TO ${RLS_ROLE};
      GRANT EXECUTE ON FUNCTION current_tenant_household_ids() TO ${RLS_ROLE};
    `);

    // Seed as the superuser (RLS bypassed): an owner + one extra member, plus an
    // unrelated outsider who belongs to no household.
    await pool.query(
      `INSERT INTO app_user (id, cognito_sub, email, status) VALUES
         ($1, $4, 'owner@test.nl', 'ACTIVE'),
         ($2, $5, 'member@test.nl', 'ACTIVE'),
         ($3, $6, 'outsider@test.nl', 'ACTIVE')`,
      [owner, member, outsider, `sub-${owner}`, `sub-${member}`, `sub-${outsider}`],
    );
    await pool.query(`INSERT INTO household (id, owner_user_id, name) VALUES ($1, $2, 'Test HH')`, [householdId, owner]);
    await pool.query(
      `INSERT INTO household_member (household_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [householdId, owner, member],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM household_member WHERE household_id = $1`, [householdId]);
    await pool.query(`DELETE FROM household WHERE id = $1`, [householdId]);
    await pool.query(`DELETE FROM app_user WHERE id = ANY($1)`, [[owner, member, outsider]]);
    await pool.query(`DROP OWNED BY ${RLS_ROLE}; DROP ROLE ${RLS_ROLE};`);
    await pool.end();
  });

  // Runs fn under the restricted role with the RLS tenant context set, then rolls back.
  const asTenant = async <T>(tenantId: string, fn: (a: HouseholdRepositoryAdapter) => Promise<T>): Promise<T> => {
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${RLS_ROLE}`);
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      return await fn(new HouseholdRepositoryAdapter(client));
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  };

  it('returns the household with its owner for the owner', async () => {
    const membership = await asTenant(owner, a => a.findMembershipForUser(owner));
    expect(membership).toEqual({ householdId, ownerUserId: owner });
  });

  it('returns the household with its owner for a non-owner member', async () => {
    const membership = await asTenant(member, a => a.findMembershipForUser(member));
    expect(membership).toEqual({ householdId, ownerUserId: owner });
  });

  it('returns null for a user who belongs to no household', async () => {
    const membership = await asTenant(outsider, a => a.findMembershipForUser(outsider));
    expect(membership).toBeNull();
  });
});
