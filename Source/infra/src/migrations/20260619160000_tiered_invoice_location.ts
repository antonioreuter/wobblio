import type { MigrationBuilder } from 'node-pg-migrate';

// Tiered invoice-location resolution (§6.5). The sharing location is resolved in three
// tiers at ingestion: the printed receipt address (RECEIPT — the only tier that
// auto-resolves), the browser upload geolocation (GEO), or the contributor profile
// (PROFILE). Tier 2 needs a place to stash the coarse upload geolocation reverse-
// geocoded at presign (raw coordinates are never persisted), and location_source must
// admit the two new provenances.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE invoice
      ADD COLUMN upload_country_code CHAR(2) NULL,
      ADD COLUMN upload_region_code  TEXT    NULL;

    ALTER TABLE invoice DROP CONSTRAINT invoice_location_source_check;
    ALTER TABLE invoice ADD CONSTRAINT invoice_location_source_check
      CHECK (location_source IS NULL OR location_source IN ('PROFILE', 'USER', 'RECEIPT', 'GEO'));
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Re-tighten to the pre-tier set; any RECEIPT/GEO rows must be normalized first.
    UPDATE invoice SET location_source = 'PROFILE'
      WHERE location_source IN ('RECEIPT', 'GEO');

    ALTER TABLE invoice DROP CONSTRAINT invoice_location_source_check;
    ALTER TABLE invoice ADD CONSTRAINT invoice_location_source_check
      CHECK (location_source IS NULL OR location_source IN ('PROFILE', 'USER'));

    ALTER TABLE invoice
      DROP COLUMN upload_country_code,
      DROP COLUMN upload_region_code;
  `);
}
