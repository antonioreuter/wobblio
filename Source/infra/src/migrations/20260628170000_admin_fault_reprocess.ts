import type { MigrationBuilder } from 'node-pg-migrate';

// Non-Functional 02 · 07 — operator reprocess-on-behalf for system-fault-quarantined
// invoices (03 set system_fault_reason + blocked_at; this lets an operator fix the root
// cause and re-run from the retained S3 file). Three thin SECURITY DEFINER primitives so
// the admin path can cross the tenant RLS boundary it otherwise can't; no business logic
// lives here (decisions stay in TS). Each is a single statement, guarded to act only on a
// still-quarantined invoice (system_fault_reason IS NOT NULL) so re-invocation is a no-op.
// Source columns are qualified to avoid the LANGUAGE sql OUT-param/column ambiguity.
// Owned by the table-owner role; deploy.sh reconciles EXECUTE to the runtime role.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Metadata-only list of quarantined invoices for the admin faults view (never invoice
    -- content — Locked decision #1). system_fault_reason is our internal root cause, shown
    -- to the operator to help fix it.
    CREATE OR REPLACE FUNCTION admin_blocked_invoices()
    RETURNS TABLE(invoice_id UUID, owner_id UUID, system_fault_reason TEXT, image_s3_key TEXT, blocked_at TIMESTAMPTZ)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT i.id, i.tenant_id, i.system_fault_reason, i.image_s3_key, i.blocked_at
      FROM invoice i
      WHERE i.system_fault_reason IS NOT NULL
      ORDER BY i.blocked_at DESC;
    $$;
    REVOKE ALL ON FUNCTION admin_blocked_invoices() FROM PUBLIC;

    -- Reprocess: release the content-addressed ledger claim (so the worker re-claims rather
    -- than short-circuiting as a duplicate), flip the invoice back to PROCESSING, and clear
    -- the quarantine — all in one statement. Returns the tenant + key the caller re-enqueues.
    -- 0 rows when the invoice isn't (any longer) quarantined → caller skips the enqueue.
    CREATE OR REPLACE FUNCTION admin_reprocess_invoice(p_invoice_id UUID)
    RETURNS TABLE(tenant_id UUID, s3_key TEXT)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    AS $$
      WITH target AS (
        SELECT i.id, i.tenant_id, i.image_s3_key
        FROM invoice i
        WHERE i.id = p_invoice_id AND i.system_fault_reason IS NOT NULL
      ),
      released AS (
        DELETE FROM ingestion_ledger l
        WHERE l.s3_key IN (SELECT t.image_s3_key FROM target t)
      ),
      reset AS (
        UPDATE invoice i
           SET status = 'PROCESSING',
               system_fault_reason = NULL,
               blocked_at = NULL,
               failure_reason_code = NULL
         WHERE i.id IN (SELECT t.id FROM target t)
        RETURNING i.tenant_id, i.image_s3_key
      )
      SELECT reset.tenant_id, reset.image_s3_key FROM reset;
    $$;
    REVOKE ALL ON FUNCTION admin_reprocess_invoice(UUID) FROM PUBLIC;

    -- Won't-process: demote a quarantined invoice to a deletable user-fault — clear the
    -- quarantine, keep FAILED_PROCESSING, stamp a friendly reason code. Returns the tenant
    -- (for an optional notification). 0 rows when not quarantined.
    CREATE OR REPLACE FUNCTION admin_wont_process_invoice(p_invoice_id UUID, p_reason_code TEXT)
    RETURNS TABLE(tenant_id UUID)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    AS $$
      UPDATE invoice i
         SET system_fault_reason = NULL,
             blocked_at = NULL,
             failure_reason_code = p_reason_code
       WHERE i.id = p_invoice_id AND i.system_fault_reason IS NOT NULL
      RETURNING i.tenant_id;
    $$;
    REVOKE ALL ON FUNCTION admin_wont_process_invoice(UUID, TEXT) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS admin_wont_process_invoice(UUID, TEXT);
    DROP FUNCTION IF EXISTS admin_reprocess_invoice(UUID);
    DROP FUNCTION IF EXISTS admin_blocked_invoices();
  `);
}
