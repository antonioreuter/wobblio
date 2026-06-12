import { getPool } from './db'

interface ProvisionParams {
  cognitoSub: string
  email: string
  fullName?: string
  country?: string
  language?: string
  currency?: string
}

/**
 * Idempotent — wraps provision_new_user which uses ON CONFLICT DO NOTHING.
 * Call after Cognito signup/confirm and on first sign-in.
 * Server-only: never imported from client components.
 */
export async function provisionUser(params: ProvisionParams): Promise<void> {
  const { cognitoSub, email, fullName = '', country = 'NL', language = 'nl', currency = 'EUR' } = params
  const pool = getPool()
  await pool.query(
    'SELECT provision_new_user($1, $2, $3::user_status, $4, $5, $6, $7)',
    [cognitoSub, email, 'ACTIVE', fullName, country, language, currency],
  )
}
