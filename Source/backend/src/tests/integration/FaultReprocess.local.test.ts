import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';

// The §07 operator-reprocess primitives are SQL-level SECURITY DEFINER functions
// (admin_blocked_invoices / admin_reprocess_invoice / admin_wont_process_invoice). They run
// as the table owner, so this seeds/reads invoice + ingestion_ledger directly (RLS bypassed)
// and drives the functions through their public signatures.
//
// Requires the local stack migrated (`npm run migrate:up`) so the functions exist.
const tenant = randomUUID();
const blockedA = randomUUID();
const blockedB = randomUUID();
const healthy = randomUUID();

const keyFor = (id: string) => `receipts/${tenant}/${id}.jpg`;

describe('admin fault reprocess — Postgres SD functions', () => {
  let pool: Pool;

  const seedQuarantined = (id: string, reason: string) =>
    pool.query(
      `INSERT INTO invoice (id, tenant_id, uploaded_by_user_id, image_s3_key, image_sha256, status, system_fault_reason, blocked_at)
       VALUES ($1, $2, $2, $3, $4, 'FAILED_PROCESSING', $5, now())`,
      [id, tenant, keyFor(id), id.replace(/-/g, '').padEnd(64, '0'), reason],
    );

  const seedLedger = (id: string) =>
    pool.query(
      `INSERT INTO ingestion_ledger (s3_key, tenant_id, status) VALUES ($1, $2, 'DONE') ON CONFLICT (s3_key) DO NOTHING`,
      [keyFor(id), tenant],
    );

  const invoice = async (id: string) => {
    const r = await pool.query<{ status: string; system_fault_reason: string | null; blocked_at: string | null; failure_reason_code: string | null }>(
      `SELECT status, system_fault_reason, blocked_at, failure_reason_code FROM invoice WHERE id = $1`,
      [id],
    );
    return r.rows[0];
  };

  const ledgerExists = async (id: string) => {
    const r = await pool.query(`SELECT 1 FROM ingestion_ledger WHERE s3_key = $1`, [keyFor(id)]);
    return r.rowCount === 1;
  };

  beforeAll(async () => {
    pool = new Pool({
      host: 'localhost', port: 5432, database: 'wobblio_local',
      user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 2,
    });
    await pool.query(
      `INSERT INTO app_user (id, cognito_sub, email, status) VALUES ($1, $2, 'fault-owner@test.nl', 'ACTIVE')`,
      [tenant, `sub-${tenant}`],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM ingestion_ledger WHERE tenant_id = $1`, [tenant]);
    await pool.query(`DELETE FROM invoice WHERE tenant_id = $1`, [tenant]);
    await pool.query(`DELETE FROM app_user WHERE id = $1`, [tenant]);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM ingestion_ledger WHERE tenant_id = $1`, [tenant]);
    await pool.query(`DELETE FROM invoice WHERE tenant_id = $1`, [tenant]);
    await seedQuarantined(blockedA, '[23514] location_source check');
    await seedQuarantined(blockedB, 'TypeError: cannot read x');
    await seedLedger(blockedA);
    await seedLedger(blockedB);
    // A healthy in-flight invoice that must never appear in the blocked list.
    await pool.query(
      `INSERT INTO invoice (id, tenant_id, uploaded_by_user_id, image_s3_key, image_sha256, status)
       VALUES ($1, $2, $2, $3, $4, 'PROCESSING')`,
      [healthy, tenant, keyFor(healthy), healthy.replace(/-/g, '').padEnd(64, '0')],
    );
  });

  it('admin_blocked_invoices lists only quarantined invoices with metadata (no content)', async () => {
    const r = await pool.query<{ invoice_id: string; owner_id: string; system_fault_reason: string; image_s3_key: string }>(
      `SELECT invoice_id, owner_id, system_fault_reason, image_s3_key FROM admin_blocked_invoices() WHERE owner_id = $1`,
      [tenant],
    );
    const ids = r.rows.map((row) => row.invoice_id).sort();
    expect(ids).toEqual([blockedA, blockedB].sort());
    expect(r.rows.every((row) => row.owner_id === tenant)).toBe(true);
    expect(r.rows.find((row) => row.invoice_id === blockedA)?.image_s3_key).toBe(keyFor(blockedA));
  });

  it('admin_reprocess_invoice releases the ledger, resets to PROCESSING, clears the quarantine', async () => {
    const r = await pool.query<{ tenant_id: string; s3_key: string }>(
      `SELECT tenant_id, s3_key FROM admin_reprocess_invoice($1)`,
      [blockedA],
    );
    expect(r.rows[0]).toEqual({ tenant_id: tenant, s3_key: keyFor(blockedA) });

    const inv = await invoice(blockedA);
    expect(inv.status).toBe('PROCESSING');
    expect(inv.system_fault_reason).toBeNull();
    expect(inv.blocked_at).toBeNull();
    expect(await ledgerExists(blockedA)).toBe(false); // claim released for re-claim
  });

  it('admin_reprocess_invoice is a no-op (0 rows) for a non-quarantined invoice', async () => {
    const r = await pool.query(`SELECT * FROM admin_reprocess_invoice($1)`, [healthy]);
    expect(r.rowCount).toBe(0);
    expect((await invoice(healthy)).status).toBe('PROCESSING');
    expect(await ledgerExists(healthy)).toBe(false); // unchanged (was never seeded)
  });

  it('admin_wont_process_invoice demotes to a deletable user-fault, keeping FAILED_PROCESSING', async () => {
    const r = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM admin_wont_process_invoice($1, $2)`,
      [blockedB, 'UNPROCESSABLE'],
    );
    expect(r.rows[0]?.tenant_id).toBe(tenant);

    const inv = await invoice(blockedB);
    expect(inv.status).toBe('FAILED_PROCESSING');
    expect(inv.system_fault_reason).toBeNull(); // no longer quarantined → deletable
    expect(inv.failure_reason_code).toBe('UNPROCESSABLE');
    expect(inv.blocked_at).toBeNull();
  });
});
