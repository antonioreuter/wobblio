import type { MigrationBuilder } from 'node-pg-migrate';

// Products become country-scoped (like merchants already are). The catalog row for an
// item belongs to the country its invoice was located in; ingestion now matches and
// creates products within a country, and the admin curation queue filters by it.
// Backfill existing (previously global) rows from the country where they were most
// often observed (non-quarantined price_observation), falling back to the launch
// market when a product has no observations yet.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE product ADD COLUMN country_code CHAR(2) NULL REFERENCES country(code);

    UPDATE product p SET country_code = sub.country_code
    FROM (
      SELECT product_id, country_code,
             ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY COUNT(*) DESC, country_code) AS rn
      FROM price_observation
      WHERE product_id IS NOT NULL AND quarantined = false
      GROUP BY product_id, country_code
    ) sub
    WHERE sub.product_id = p.id AND sub.rn = 1;

    UPDATE product SET country_code = 'NL' WHERE country_code IS NULL;

    CREATE INDEX product_country_status_idx ON product (country_code, status);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS product_country_status_idx;
    ALTER TABLE product DROP COLUMN IF EXISTS country_code;
  `);
}
