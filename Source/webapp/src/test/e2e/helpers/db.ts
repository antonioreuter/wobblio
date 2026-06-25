import { Pool } from 'pg'

// Direct Postgres access for E2E state setup/teardown against the local stack
// (scripts/local/docker-compose.yml). Used to inspect/reset onboarding and to
// delete a user to simulate a purged account (zombie session).
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'wobblio_local',
  user: 'wobblio_dev',
  password: 'wobblio_dev_secret',
  max: 2,
})

export async function getOnboarded(email: string): Promise<boolean> {
  const res = await pool.query<{ onboarded: boolean }>(
    'SELECT onboarded_at IS NOT NULL AS onboarded FROM app_user WHERE email = $1',
    [email],
  )
  return res.rows[0]?.onboarded ?? false
}

// Put a user back into the "registered but not onboarded" state.
export async function resetOnboarding(email: string): Promise<void> {
  await pool.query(
    'UPDATE app_user SET onboarded_at = NULL, birthdate = NULL, gdpr_consent_at = NULL WHERE email = $1',
    [email],
  )
}

// Simulate a purged account: the Cognito (cognito-local) user may still exist but
// the app_user row is gone → backend /me/profile returns 401 (zombie session).
// Households the user owns (and any membership/invite rows) are cleared first so
// the app_user delete doesn't trip the household_owner_user_id_fkey.
export async function deleteUser(email: string): Promise<void> {
  const owned = `SELECT h.id FROM household h JOIN app_user u ON u.id = h.owner_user_id WHERE u.email = $1`
  await pool.query(`UPDATE invoice SET household_id = NULL WHERE household_id IN (${owned})`, [email])
  await pool.query(`DELETE FROM household_invite WHERE household_id IN (${owned})`, [email])
  await pool.query(`DELETE FROM household_member WHERE household_id IN (${owned})`, [email])
  await pool.query('DELETE FROM household_member WHERE user_id IN (SELECT id FROM app_user WHERE email = $1)', [email])
  await pool.query(`DELETE FROM household WHERE id IN (${owned})`, [email])
  await pool.query('DELETE FROM app_user WHERE email = $1', [email])
}

// Flip a user's role directly (the role column is never client-writable). Used to
// promote an E2E user to PREMIUM so they can own a household. The session reads
// role from the DB at sign-in, so callers must re-login for it to take effect.
export async function setRole(email: string, role: string): Promise<void> {
  await pool.query('UPDATE app_user SET role = $2 WHERE email = $1', [email, role])
}

export async function closeDb(): Promise<void> {
  await pool.end()
}
