import type { MigrationBuilder } from 'node-pg-migrate';

// Three independent ingestion fixes that all need DDL:
//   1. invoice_line.line_index — the PK is a random uuid_generate_v4(), so reads that
//      did ORDER BY id returned lines in random order; persist + order by the receipt
//      position instead so discounts sit next to the product they apply to.
//   2. invoice.price_emission_blocked — a receipt deleted then re-uploaded is now a
//      normal (PARSED) invoice, but its original already contributed non-retractable
//      price observations (§6.5). This flag permanently keeps the re-upload out of the
//      price index, including the deferred/PENDING-location re-emission path.
//   3. cat-<macro>-deposit "Deposits & Returns" leaves — deposits (statiegeld) used to
//      fall into "Other"; they now get a trackable per-macro bucket mirroring the
//      existing tax/discount/other pattern (20260619120000).
//
// DEPOSIT_CATEGORIES is exported so test/seed_reference_data.test.ts folds it into the
// effective snapshot and keeps the migration / local seed / backend taxonomy in sync.

export interface CategoryRow { id: string; parentId: string | null; name: string; nameNl: string; level: number; }

const DEPOSIT_MACRO_IDS = [
  'cat-groceries', 'cat-household', 'cat-personal-care', 'cat-baby', 'cat-pet',
  'cat-dining-out', 'cat-transport', 'cat-clothing', 'cat-electronics', 'cat-health',
  'cat-home-garden', 'cat-entertainment', 'cat-services', 'cat-lodging', 'cat-bars-pubs',
  'cat-hardware', 'cat-other',
];

export const DEPOSIT_CATEGORIES: CategoryRow[] = DEPOSIT_MACRO_IDS.map((macroId) => ({
  id: `${macroId}-deposit`,
  parentId: macroId,
  name: 'Deposits & Returns',
  nameNl: 'Statiegeld & Retour',
  level: 2,
}));

const sqlLiteral = (value: string | null): string =>
  value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE invoice_line ADD COLUMN IF NOT EXISTS line_index INT NOT NULL DEFAULT 0;
    ALTER TABLE invoice ADD COLUMN IF NOT EXISTS price_emission_blocked BOOLEAN NOT NULL DEFAULT false;
  `);

  // Best-effort backfill of existing rows: preserve current physical order so historical
  // invoices keep whatever order they already displayed.
  pgm.sql(`
    UPDATE invoice_line il
    SET line_index = ordered.rn - 1
    FROM (
      SELECT id, row_number() OVER (PARTITION BY invoice_id ORDER BY ctid) AS rn
      FROM invoice_line
    ) ordered
    WHERE ordered.id = il.id;
  `);

  const rows = DEPOSIT_CATEGORIES
    .map((c) => `(${sqlLiteral(c.id)}, ${sqlLiteral(c.parentId)}, ${sqlLiteral(c.name)}, ${sqlLiteral(c.nameNl)}, ${c.level})`)
    .join(',\n    ');
  pgm.sql(`
    INSERT INTO product_category (id, parent_id, name, name_nl, level) VALUES
    ${rows}
    ON CONFLICT (id) DO NOTHING;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE invoice_line DROP COLUMN IF EXISTS line_index;
    ALTER TABLE invoice DROP COLUMN IF EXISTS price_emission_blocked;
  `);
  // Deposit leaves become FK targets as soon as ingestion runs; only delete the ones
  // still unreferenced so a populated-stage rollback never throws.
  for (const c of DEPOSIT_CATEGORIES) {
    pgm.sql(`DELETE FROM product_category WHERE id = ${sqlLiteral(c.id)} AND NOT EXISTS (
      SELECT 1 FROM invoice_line WHERE category_id = ${sqlLiteral(c.id)}
    );`);
  }
}
