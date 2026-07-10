import type { MigrationBuilder } from 'node-pg-migrate';

// Venue content leaves for Dining Out and Bars & Pubs (fixes/08). Before this, both
// macros carried only the structural tax/discount/other/deposit leaves, so a served
// meal or drink had no specific home and the per-line product-expansion model dumped
// restaurant items into grocery leaves (cat-ready-deli, cat-beverages, cat-meat-fish),
// which roll up to Groceries in the spend-breakdown report. These leaves give
// venue-served food/drink a proper home so the report attributes it to Dining Out.
//
// Mirrors src/local/seeds/product-taxonomy.ts and backend CATEGORY_TAXONOMY; the delta
// below is exported so test/seed_reference_data.test.ts folds it into the effective
// snapshot and keeps all three copies pinned in sync.

export interface CategoryRow { id: string; parentId: string | null; name: string; nameNl: string; level: number; }

export const VENUE_CATEGORIES: CategoryRow[] = [
  { id: 'cat-dining-meals', parentId: 'cat-dining-out', name: 'Meals & Dishes', nameNl: 'Maaltijden & Gerechten', level: 2 },
  { id: 'cat-dining-drinks', parentId: 'cat-dining-out', name: 'Drinks', nameNl: 'Drankjes', level: 2 },
  { id: 'cat-dining-snacks', parentId: 'cat-dining-out', name: 'Snacks & Sides', nameNl: 'Snacks & Bijgerechten', level: 2 },
  { id: 'cat-bar-drinks', parentId: 'cat-bars-pubs', name: 'Drinks', nameNl: 'Drankjes', level: 2 },
  { id: 'cat-bar-food', parentId: 'cat-bars-pubs', name: 'Bar Food', nameNl: 'Barhapjes', level: 2 },
];

const sqlLiteral = (value: string | null): string =>
  value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  const rows = VENUE_CATEGORIES
    .map((c) => `(${sqlLiteral(c.id)}, ${sqlLiteral(c.parentId)}, ${sqlLiteral(c.name)}, ${sqlLiteral(c.nameNl)}, ${c.level})`)
    .join(',\n    ');
  pgm.sql(`
    INSERT INTO product_category (id, parent_id, name, name_nl, level) VALUES
    ${rows}
    ON CONFLICT (id) DO NOTHING;
  `);
}

// No-op down, matching the reference-data convention (20260619120000): these leaves become
// FK targets for invoice_line AND product / product_concept / budget / shopping_list as soon
// as ingestion runs, so a DELETE would throw on any populated stage (a guard against only
// invoice_line would still miss a product row). up() is idempotent (ON CONFLICT DO NOTHING).
export async function down(): Promise<void> {}
