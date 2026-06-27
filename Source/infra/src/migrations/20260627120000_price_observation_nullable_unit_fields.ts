import type { MigrationBuilder } from 'node-pg-migrate';

// §6.5 design inversion: pack_price (line_total/quantity) is the always-available price
// signal; per-unit price requires a pack size that NL/EU supermarket receipts usually omit
// on the line. normalized_unit_price and base_unit therefore become OPTIONAL enrichment —
// an observation now emits on pack_price alone, carrying the per-unit fields only when a
// real pack size was resolved (printed token, deposit signal, or user confirmation).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE price_observation ALTER COLUMN normalized_unit_price DROP NOT NULL;
    ALTER TABLE price_observation ALTER COLUMN base_unit DROP NOT NULL;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Re-imposing NOT NULL requires removing the pack-price-only rows the new design emits.
  pgm.sql(`
    DELETE FROM price_observation WHERE normalized_unit_price IS NULL OR base_unit IS NULL;
    ALTER TABLE price_observation ALTER COLUMN normalized_unit_price SET NOT NULL;
    ALTER TABLE price_observation ALTER COLUMN base_unit SET NOT NULL;
  `);
}
