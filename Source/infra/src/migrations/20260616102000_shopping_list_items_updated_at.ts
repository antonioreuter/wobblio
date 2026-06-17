import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Offline last-write-wins needs a per-item updated_at (mobile sync, §10).
    ALTER TABLE shopping_list_item
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

    -- Trigram index for product autocomplete on the user-facing display name
    -- (alias search already has product_alias_trgm_idx).
    CREATE INDEX IF NOT EXISTS product_display_name_trgm_idx
      ON product USING gin (display_name gin_trgm_ops);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS product_display_name_trgm_idx;
    ALTER TABLE shopping_list_item DROP COLUMN IF EXISTS updated_at;
  `);
}
