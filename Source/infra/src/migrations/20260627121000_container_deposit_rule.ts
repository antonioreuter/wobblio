import type { MigrationBuilder } from 'node-pg-migrate';

// §6.3 pack-size enrichment: a regulated container deposit (statiegeld/pfand/…) is a
// high-confidence signal for a beverage's pack size when the receipt line omits it. The
// table is per-country reference data (no NL hardcoding in code); the ingestion worker
// reads it when a product line is immediately followed by a deposit line.
//
// Seeded here and kept across dev resets (added to reset-dev PRESERVE_TABLES) — it is
// migration-seeded config the catalog reseed does not restore. Only unambiguous bands are
// seeded; ambiguous deposits (e.g. NL €0.15 = 0.33L can or 0.5L bottle) are intentionally
// omitted so we never guess.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE container_deposit_rule (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      country_code char(2) NOT NULL,
      deposit_min numeric NOT NULL,
      deposit_max numeric NOT NULL,
      base_unit product_base_unit NOT NULL,
      implied_pack_size numeric NOT NULL,
      note text,
      CONSTRAINT container_deposit_rule_range CHECK (deposit_min <= deposit_max),
      CONSTRAINT container_deposit_rule_size CHECK (implied_pack_size > 0)
    );
    CREATE INDEX container_deposit_rule_country_idx ON container_deposit_rule (country_code);

    -- NL: €0.25 statiegeld applies to plastic bottles > 1 L; the dominant SKU is 1.5 L.
    INSERT INTO container_deposit_rule
      (country_code, deposit_min, deposit_max, base_unit, implied_pack_size, note)
    VALUES
      ('NL', 0.24, 0.26, 'L', 1.5, 'PET bottle > 1L (statiegeld €0.25) — dominant size 1.5L');
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS container_deposit_rule;');
}
