import type { MigrationBuilder } from 'node-pg-migrate';

// Reaper for invoices stuck in the non-terminal PROCESSING state. The ingestion worker
// flips an invoice to FAILED_PROCESSING on its final delivery before the DLQ, but that
// best-effort path is missed when the worker times out, crashes on init, or the message
// is lost — leaving the invoice in PROCESSING forever, which isDeletable() refuses to
// delete. This SECURITY DEFINER function (runs as the owner, so it spans tenants past
// RLS, like the other purge_* maintenance functions) flips any invoice that has been
// PROCESSING well beyond the worker's retry budget to the terminal FAILED_PROCESSING,
// making it deletable. EXECUTE defaults to PUBLIC so the non-owner runtime role can call it.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION fail_stuck_invoices()
    RETURNS INT
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_count INT;
    BEGIN
      UPDATE invoice
         SET status = 'FAILED_PROCESSING'
       WHERE status = 'PROCESSING'
         AND created_at < now() - INTERVAL '30 minutes';
      GET DIAGNOSTICS v_count = ROW_COUNT;
      RETURN v_count;
    END;
    $$;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP FUNCTION IF EXISTS fail_stuck_invoices();`);
}
