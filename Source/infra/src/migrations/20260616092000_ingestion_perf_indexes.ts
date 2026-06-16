import type { MigrationBuilder } from 'node-pg-migrate';

// Hot-path indexes for the ingestion + read paths. Without these, invoice
// detail seq-scans the ~16M-row invoice_line table and the dashboard listing
// seq-scans invoice; on db.t3.micro that burns burst credits and evicts cache.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS invoice_line_invoice_idx
      ON invoice_line (invoice_id);

    CREATE INDEX IF NOT EXISTS invoice_tenant_created_idx
      ON invoice (tenant_id, created_at DESC);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS invoice_tenant_created_idx;
    DROP INDEX IF EXISTS invoice_line_invoice_idx;
  `);
}
