import type { MigrationBuilder } from 'node-pg-migrate';

// Product catalog cleanup (amendment 2026-06-22). Remove dead scaffolding:
//  - product_concept + product.concept_id: never written, never read; §12.1 R-5 deferred
//    them to phase 2 ("schema ships, UI does not"). Reintroduced as a forward migration when
//    the concept-level feature is built.
//  - product_alias.match_count + last_seen_at: writeAlias used WHERE NOT EXISTS (no
//    ON CONFLICT), so match_count was stuck at 1 and last_seen_at write-once; nothing reads
//    them.
// product.brand already exists in the initial schema and is now populated by the expansion
// pipeline — no schema change needed for it.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE product DROP COLUMN concept_id;
    DROP TABLE product_concept;
    ALTER TABLE product_alias DROP COLUMN match_count;
    ALTER TABLE product_alias DROP COLUMN last_seen_at;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE product_concept (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name        TEXT NOT NULL,
      category_id TEXT NOT NULL REFERENCES product_category(id)
    );
    ALTER TABLE product ADD COLUMN concept_id UUID NULL REFERENCES product_concept(id);
    ALTER TABLE product_alias ADD COLUMN match_count INT NOT NULL DEFAULT 0;
    ALTER TABLE product_alias ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();
  `);
}
