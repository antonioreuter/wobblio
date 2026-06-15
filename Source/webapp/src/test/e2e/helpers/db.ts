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
export async function deleteUser(email: string): Promise<void> {
  await pool.query('DELETE FROM app_user WHERE email = $1', [email])
}

export async function closeDb(): Promise<void> {
  await pool.end()
}
