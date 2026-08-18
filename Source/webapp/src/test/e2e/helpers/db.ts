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
  // invoice.tenant_id has no ON DELETE CASCADE — any invoice seeded for this user
  // (e.g. seedParsedInvoice) must be torn down first or the app_user delete below
  // trips a FK violation. bill_split_line → bill_split → invoice_line/feedback →
  // invoice is the dependency order (invoice_share/invoice_telemetry cascade).
  const tenantInvoices = `SELECT id FROM invoice WHERE tenant_id = (SELECT id FROM app_user WHERE email = $1)`
  await pool.query(
    `DELETE FROM bill_split_line WHERE line_id IN (SELECT id FROM invoice_line WHERE invoice_id IN (${tenantInvoices}))`,
    [email],
  )
  await pool.query(`DELETE FROM bill_split WHERE invoice_id IN (${tenantInvoices})`, [email])
  await pool.query(`DELETE FROM invoice_feedback WHERE invoice_id IN (${tenantInvoices})`, [email])
  await pool.query(`DELETE FROM invoice_line WHERE invoice_id IN (${tenantInvoices})`, [email])
  await pool.query('DELETE FROM invoice WHERE tenant_id = (SELECT id FROM app_user WHERE email = $1)', [email])
  await pool.query('DELETE FROM app_user WHERE email = $1', [email])
}

// Seeds a PARSED invoice directly (skips upload + real Bedrock parsing) so E2E
// specs can exercise post-parse features like bill splitting deterministically.
// location_status is forced RESOLVED so InvoiceLocationGate never intercepts.
export async function seedParsedInvoice(
  email: string,
  lines: { rawText: string; lineTotal: number; quantity?: number }[],
): Promise<{ invoiceId: string; lineIds: string[] }> {
  const userRes = await pool.query<{ id: string }>('SELECT id FROM app_user WHERE email = $1', [email])
  const tenantId = userRes.rows[0].id
  const total = lines.reduce((sum, l) => sum + l.lineTotal, 0)
  const invoiceRes = await pool.query<{ id: string }>(
    `INSERT INTO invoice
       (tenant_id, uploaded_by_user_id, status, transaction_date, currency, total, category_id,
        image_s3_key, image_sha256, location_status)
     VALUES ($1, $1, 'PARSED', CURRENT_DATE, 'EUR', $2, 'cat-groceries', $3, $4, 'RESOLVED')
     RETURNING id`,
    [tenantId, total, `e2e/${tenantId}.jpg`, `e2e-${tenantId}-${Date.now()}`],
  )
  const invoiceId = invoiceRes.rows[0].id
  const lineIds: string[] = []
  for (const [i, line] of lines.entries()) {
    const lineRes = await pool.query<{ id: string }>(
      `INSERT INTO invoice_line (invoice_id, line_index, raw_text, quantity, line_total)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [invoiceId, i, line.rawText, line.quantity ?? 1, line.lineTotal],
    )
    lineIds.push(lineRes.rows[0].id)
  }
  return { invoiceId, lineIds }
}

// Flip a user's role directly (the role column is never client-writable). Used to
// promote an E2E user to PREMIUM so they can own a household. The session reads
// role from the DB at sign-in, so callers must re-login for it to take effect.
export async function setRole(email: string, role: string): Promise<void> {
  await pool.query('UPDATE app_user SET role = $2 WHERE email = $1', [email, role])
}

// Pin the profile region the reports page defaults to, so a trends spec never depends on what
// the onboarding form happened to leave in country_code/region_code.
export async function setRegion(email: string, countryCode: string, regionCode: string): Promise<void> {
  await pool.query('UPDATE app_user SET country_code = $2, region_code = $3 WHERE email = $1', [
    email,
    countryCode,
    regionCode,
  ])
}

// Seeds ONE own purchase of a brand-new product in a location-RESOLVED invoice, which is the
// minimum the price-trends report needs to draw a series (own history has no quorum gate). The
// single week is deliberate: it is the case that used to render as an invisible speck.
export async function seedOwnPurchase(
  email: string,
  opts: { displayName: string; price: number; countryCode: string; regionCode: string },
): Promise<{ productId: string; invoiceId: string }> {
  const userRes = await pool.query<{ id: string }>('SELECT id FROM app_user WHERE email = $1', [email])
  const tenantId = userRes.rows[0].id
  const productRes = await pool.query<{ id: string }>(
    `INSERT INTO product (category_id, brand, display_name, base_unit, status)
     VALUES ('cat-groceries', NULL, $1, 'PIECE', 'ACTIVE') RETURNING id`,
    [opts.displayName],
  )
  const productId = productRes.rows[0].id
  const invoiceRes = await pool.query<{ id: string }>(
    `INSERT INTO invoice
       (tenant_id, uploaded_by_user_id, status, transaction_date, currency, total, category_id,
        image_s3_key, image_sha256, location_country_code, location_region_code, location_status)
     VALUES ($1, $1, 'PARSED', CURRENT_DATE, 'EUR', $2, 'cat-groceries', $3, $4, $5, $6, 'RESOLVED')
     RETURNING id`,
    [tenantId, opts.price, `e2e/${tenantId}-trend.jpg`, `e2e-trend-${tenantId}-${Date.now()}`, opts.countryCode, opts.regionCode],
  )
  const invoiceId = invoiceRes.rows[0].id
  await pool.query(
    `INSERT INTO invoice_line (invoice_id, line_index, raw_text, product_id, quantity, line_total)
     VALUES ($1, 0, $2, $3, 1, $4)`,
    [invoiceId, opts.displayName, productId, opts.price],
  )
  return { productId, invoiceId }
}

export async function deleteProduct(productId: string): Promise<void> {
  await pool.query('DELETE FROM price_observation WHERE product_id = $1', [productId])
  await pool.query('DELETE FROM product WHERE id = $1', [productId])
}

export async function closeDb(): Promise<void> {
  await pool.end()
}
