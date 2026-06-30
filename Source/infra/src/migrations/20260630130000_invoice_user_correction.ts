import type { MigrationBuilder } from 'node-pg-migrate';

// Mobile 16e — user review & correction. corrected_at records that a human fixed the
// parsed fields/line items on this invoice. It drives the price-observation quality:
// observations built from a corrected invoice are emitted USER_CONFIRMED rather than
// AUTO (§6.5). Emission still happens at the existing location-confirm gate and reads
// the (now corrected) invoice_line rows — the de-identified Price Observation Store
// keeps no invoice reference (invariant #2), so this flag on the invoice is how the
// emission path learns the rows are user-trusted. NULL = never corrected (AUTO).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE invoice
      ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMPTZ NULL;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE invoice
      DROP COLUMN IF EXISTS corrected_at;
  `);
}
