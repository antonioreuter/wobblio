import type { MigrationBuilder } from 'node-pg-migrate';

// Fix 09/02 — per-merchant product identity. A product belongs to exactly one merchant:
// "AH halfvolle melk" and "Jumbo halfvolle melk" are two products, even if physically
// identical. Whether they are comparable is the user's call (comparison sets, 09/04), not
// an embedding threshold's. Embedding candidate search is restricted to the same merchant,
// removing the ≥0.92 cross-merchant acceptance that silently merged distinct SKUs.
//
// merchant_id is NULL-able only for (a) pre-split legacy rows during the 09/03 transition and
// (b) any surviving merchant-agnostic seed products; every new AUTO/ADMIN product is stamped
// with the resolving receipt's merchant.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE product ADD COLUMN merchant_id UUID NULL REFERENCES merchant(id);

    -- Serves the merchant-scoped embedding candidate search (09/02 step 3).
    CREATE INDEX idx_product_merchant_category ON product (merchant_id, category_id);
    -- Advisory (non-unique) duplicate-detection index for admin tooling.
    CREATE INDEX idx_product_merchant_name ON product (merchant_id, display_name, brand);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_product_merchant_name;
    DROP INDEX IF EXISTS idx_product_merchant_category;
    ALTER TABLE product DROP COLUMN merchant_id;
  `);
}
