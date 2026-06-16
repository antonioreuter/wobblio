import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Global (no-RLS) ISO 3166 reference data. Single source of truth for
    -- onboarding country/region selection and region-code validation. Region
    -- codes are ISO 3166-2 (e.g. 'NL-NB', 'US-CA', 'BR-SP') so they are
    -- country-qualified by construction and never collide across countries in
    -- the RLS-exempt price_observation store.
    CREATE TABLE country (
      code CHAR(2) PRIMARY KEY,   -- ISO 3166-1 alpha-2
      name TEXT    NOT NULL
    );

    CREATE TABLE country_subdivision (
      code         TEXT    PRIMARY KEY,            -- ISO 3166-2, e.g. 'NL-NB'
      country_code CHAR(2) NOT NULL REFERENCES country(code),
      name         TEXT    NOT NULL
    );

    CREATE INDEX country_subdivision_country_idx ON country_subdivision (country_code);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS country_subdivision CASCADE;
    DROP TABLE IF EXISTS country            CASCADE;
  `);
}
