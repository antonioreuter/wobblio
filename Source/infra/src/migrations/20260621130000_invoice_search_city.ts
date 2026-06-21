import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Free-text receipt city for invoice search (e.g. "Eindhoven"). Kept separate from
    -- search_tags so it never pollutes the closed §6.10 tag vocabulary, and out of the
    -- price observation store. Tenant-scoped (covered by the existing invoice RLS
    -- policy); not encrypted — a city is no more sensitive than the region code already
    -- stored in plaintext (§7.5 encryption scope excludes it).
    ALTER TABLE invoice ADD COLUMN search_city TEXT NULL;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE invoice DROP COLUMN IF EXISTS search_city;
  `);
}
