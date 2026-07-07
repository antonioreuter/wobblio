import type { MigrationBuilder } from 'node-pg-migrate';

// Covering indexes for the hierarchical spend-breakdown report (GET /reports/spend).
// The report scans a tenant's invoices in a ≤90-day window and groups their lines by
// category → merchant → item-category → product. The existing invoice_line(invoice_id)
// index supports the join; adding category_id makes the group-by covering. The
// invoice(tenant_id, transaction_date) index speeds the windowed scan (the common case
// where transaction_date is set — the COALESCE fallback to created_at stays a filter).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS invoice_line_invoice_category_idx
      ON invoice_line (invoice_id, category_id);

    CREATE INDEX IF NOT EXISTS invoice_tenant_txn_date_idx
      ON invoice (tenant_id, transaction_date);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS invoice_line_invoice_category_idx;
    DROP INDEX IF EXISTS invoice_tenant_txn_date_idx;
  `);
}
