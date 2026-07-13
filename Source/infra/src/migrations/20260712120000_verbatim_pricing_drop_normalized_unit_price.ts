import type { MigrationBuilder } from 'node-pg-migrate';

// Fix 09/01 — receipt-verbatim pricing. The derived per-unit price
// (normalized_unit_price = line_total ÷ quantity ÷ pack_size) is removed from the
// system: it inferred a pack size ~96% of NL/EU lines never print. pack_price
// (line_total ÷ quantity, pure receipt arithmetic) becomes the sole price signal.
//
//   • invoice_line.normalized_unit_price  → dropped
//   • price_observation.normalized_unit_price + base_unit → dropped (pack_price is the
//     only price column; invariant #2 key / de-identification / quarantine untouched)
//
// Pack size survives only as descriptive/identity metadata (pack_quantity + base_unit on
// invoice_line) with an evidence state: size_source = RECEIPT when a size token was
// printed on the line, USER when set via the review-screen "Set size" affordance, NULL
// when the size is unknown (never inferred).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TYPE size_source AS ENUM ('RECEIPT', 'USER');

    ALTER TABLE invoice_line ADD COLUMN size_source size_source NULL;
    ALTER TABLE invoice_line DROP COLUMN normalized_unit_price;

    ALTER TABLE price_observation DROP COLUMN normalized_unit_price;
    ALTER TABLE price_observation DROP COLUMN base_unit;
  `);
}

// Lossy down: the derived figures are not reconstructible, so the restored columns are
// NULL-able (the originals were NOT NULL on price_observation) and left empty.
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE price_observation ADD COLUMN base_unit product_base_unit NULL;
    ALTER TABLE price_observation ADD COLUMN normalized_unit_price NUMERIC(10,4) NULL;

    ALTER TABLE invoice_line ADD COLUMN normalized_unit_price NUMERIC(10,4) NULL;
    ALTER TABLE invoice_line DROP COLUMN size_source;

    DROP TYPE size_source;
  `);
}
