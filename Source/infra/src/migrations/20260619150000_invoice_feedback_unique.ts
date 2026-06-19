import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- One verdict per (invoice, tenant): the feedback button upserts on this key so a
    -- user re-rating a receipt overwrites their prior verdict instead of stacking rows.
    CREATE UNIQUE INDEX invoice_feedback_invoice_tenant_uidx
      ON invoice_feedback (invoice_id, tenant_id);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS invoice_feedback_invoice_tenant_uidx;
  `);
}
