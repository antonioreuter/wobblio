import type { MigrationBuilder } from 'node-pg-migrate';

// Retire the deposit→size inference (reverted per product decision): a regulated deposit is
// still a guess at pack size, and we now infer size only from what is printed on the receipt
// line. Drop the reference table introduced in 20260627121000_container_deposit_rule.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS container_deposit_rule;');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
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
    INSERT INTO container_deposit_rule
      (country_code, deposit_min, deposit_max, base_unit, implied_pack_size, note)
    VALUES
      ('NL', 0.24, 0.26, 'L', 1.5, 'PET bottle > 1L (statiegeld €0.25) — dominant size 1.5L');
  `);
}
