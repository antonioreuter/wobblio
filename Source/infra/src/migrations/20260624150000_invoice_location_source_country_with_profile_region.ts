import type { MigrationBuilder } from 'node-pg-migrate';

// COUNTRY_WITH_PROFILE_REGION was added to the domain's LocationSource type (region.ts)
// as the source for invoices where the receipt's country matched the profile country and
// the region came from the contributor profile. The DB constraint was never updated to
// include it, causing ingestion failures when this path fires (check constraint 23514).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE invoice DROP CONSTRAINT invoice_location_source_check;
    ALTER TABLE invoice ADD CONSTRAINT invoice_location_source_check
      CHECK (location_source IS NULL OR location_source IN ('PROFILE', 'USER', 'RECEIPT', 'GEO', 'COUNTRY_WITH_PROFILE_REGION'));
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    UPDATE invoice SET location_source = 'PROFILE'
      WHERE location_source = 'COUNTRY_WITH_PROFILE_REGION';

    ALTER TABLE invoice DROP CONSTRAINT invoice_location_source_check;
    ALTER TABLE invoice ADD CONSTRAINT invoice_location_source_check
      CHECK (location_source IS NULL OR location_source IN ('PROFILE', 'USER', 'RECEIPT', 'GEO'));
  `);
}
