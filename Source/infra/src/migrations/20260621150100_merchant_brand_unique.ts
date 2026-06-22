import type { MigrationBuilder } from 'node-pg-migrate';

// Prevent duplicate merchants for the same brand (amendment 2026-06-21). Before this,
// merchant had no uniqueness on (brand_name, country_code), so an over-captured receipt
// header that missed the alias search drove the LLM fallback to declare is_new and create
// a second "Albert Heijn" alongside the ACTIVE seed. This (a) consolidates existing
// brand-name duplicates into a canonical merchant, then (b) adds the uniqueness constraint
// + a brand_name trigram index the resolver's brand-level candidate lookup uses.
//
// Canonical pick per (lower(brand_name), country_code) group: SEED first, then ACTIVE,
// then oldest id. All merchant FKs (price_observation, invoice, product_alias,
// merchant_alias) reassign to the canonical before the losers are deleted. merchant_branch
// is gone by now (dropped in 20260621150000), so it is not reassigned. Idempotent.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DO $$
    DECLARE
      grp RECORD;
      canonical UUID;
      dup UUID;
    BEGIN
      FOR grp IN
        SELECT lower(brand_name) AS lname, country_code
        FROM merchant
        GROUP BY lower(brand_name), country_code
        HAVING count(*) > 1
      LOOP
        SELECT id INTO canonical
        FROM merchant
        WHERE lower(brand_name) = grp.lname AND country_code = grp.country_code
        ORDER BY (created_via = 'SEED') DESC, (status = 'ACTIVE') DESC, id ASC
        LIMIT 1;

        FOR dup IN
          SELECT id FROM merchant
          WHERE lower(brand_name) = grp.lname AND country_code = grp.country_code
            AND id <> canonical
        LOOP
          UPDATE price_observation SET merchant_id = canonical WHERE merchant_id = dup;
          UPDATE invoice           SET merchant_id = canonical WHERE merchant_id = dup;
          UPDATE product_alias     SET merchant_id = canonical WHERE merchant_id = dup;

          -- Drop the duplicate's aliases the canonical already owns (unique on
          -- alias_normalized + country_code), then reassign the remaining unique ones.
          DELETE FROM merchant_alias d_a
          USING merchant_alias s_a
          WHERE d_a.merchant_id = dup
            AND s_a.merchant_id = canonical
            AND s_a.alias_normalized = d_a.alias_normalized
            AND s_a.country_code = d_a.country_code;
          UPDATE merchant_alias SET merchant_id = canonical WHERE merchant_id = dup;

          DELETE FROM merchant WHERE id = dup;
        END LOOP;
      END LOOP;
    END $$;

    CREATE INDEX IF NOT EXISTS merchant_brand_name_trgm_idx
      ON merchant USING gin (brand_name gin_trgm_ops);
    CREATE UNIQUE INDEX IF NOT EXISTS merchant_brand_country_uidx
      ON merchant (brand_name, country_code);
  `);
}

// The merge cannot be safely reversed; only the indexes are dropped.
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS merchant_brand_country_uidx;
    DROP INDEX IF EXISTS merchant_brand_name_trgm_idx;
  `);
}
