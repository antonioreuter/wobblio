import type { MigrationBuilder } from 'node-pg-migrate';

// §11 bill splitting — generalise a line assignment from "one participant + a
// fraction of the whole line" to per-unit allocations: multiple participants can
// each take a quantity of a line's units (e.g. 3 items → 2 to Alice, 1 to Bob),
// while fractional units still express a single shared item (½, ⅓). A surrogate
// id PK replaces the old (split_id, line_id) PK so a line can hold several rows.
// The remainder (line quantity − Σ allocated units) stays with the account holder.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE bill_split_line DROP CONSTRAINT bill_split_line_pkey;

    ALTER TABLE bill_split_line
      ADD COLUMN id    UUID          NOT NULL DEFAULT uuid_generate_v4(),
      ADD COLUMN units NUMERIC(9,4);

    -- Backfill: the old fraction was a share of the whole line, so units = fraction × line quantity.
    UPDATE bill_split_line bsl
      SET units = bsl.fraction * COALESCE(NULLIF(il.quantity, 0), 1)
      FROM invoice_line il
      WHERE il.id = bsl.line_id;

    ALTER TABLE bill_split_line ALTER COLUMN units SET NOT NULL;
    ALTER TABLE bill_split_line DROP COLUMN fraction;
    ALTER TABLE bill_split_line ADD PRIMARY KEY (id);

    CREATE INDEX bill_split_line_split_line_idx ON bill_split_line (split_id, line_id);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS bill_split_line_split_line_idx;

    ALTER TABLE bill_split_line ADD COLUMN fraction NUMERIC(5,4);
    UPDATE bill_split_line bsl
      SET fraction = LEAST(1, bsl.units / COALESCE(NULLIF(il.quantity, 0), 1))
      FROM invoice_line il
      WHERE il.id = bsl.line_id;
    ALTER TABLE bill_split_line ALTER COLUMN fraction SET NOT NULL;

    ALTER TABLE bill_split_line DROP CONSTRAINT bill_split_line_pkey;
    ALTER TABLE bill_split_line DROP COLUMN id;
    ALTER TABLE bill_split_line DROP COLUMN units;

    -- Collapse any multi-participant lines to one row so the old PK can be restored.
    DELETE FROM bill_split_line a
      USING bill_split_line b
      WHERE a.ctid < b.ctid AND a.split_id = b.split_id AND a.line_id = b.line_id;
    ALTER TABLE bill_split_line ADD PRIMARY KEY (split_id, line_id);
  `);
}
