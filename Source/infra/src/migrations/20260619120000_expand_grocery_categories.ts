import type { MigrationBuilder } from 'node-pg-migrate';

// Grocery taxonomy expansion. The base snapshot (20260616100000) is shipped and never
// edited, so already-migrated stages need this follow-up to (a) rename the awkward
// "Produce" leaf to "Fruits & Vegetables" — id kept stable so existing invoice_line /
// product / tag references survive — (b) add finer grocery leaves, and (c) retire the
// catch-all "Pantry" leaf, whose contents are now covered by the new leaves. Existing
// rows that still point at cat-pantry are remapped to cat-grains before the row is
// deleted, so the FK from product / product_concept / invoice / invoice_line / budget
// never breaks.
//
// Mirrors src/local/seeds/product-taxonomy.ts and backend CATEGORY_TAXONOMY; the delta
// below is exported so test/seed_reference_data.test.ts can fold it into the base
// snapshot and keep all three copies pinned in sync.

export interface CategoryRow { id: string; parentId: string | null; name: string; nameNl: string; level: number; }
export interface CategoryRename { id: string; name: string; nameNl: string; }

export const RENAMED_CATEGORIES: CategoryRename[] = [
  { id: 'cat-produce', name: 'Fruits & Vegetables', nameNl: 'Groente & Fruit' },
];

// Retired leaves and where their pre-existing rows are remapped before deletion.
export const REMOVED_CATEGORIES: ReadonlyArray<string> = ['cat-pantry'];
const REMAP_TARGET = 'cat-grains';
const CATEGORY_FK_TABLES = ['product', 'product_concept', 'invoice', 'invoice_line', 'budget'];

const EXPLICIT_ADDED: CategoryRow[] = [
  { id: 'cat-lodging', parentId: null, name: 'Accommodation', nameNl: 'Accommodatie', level: 1 },
  { id: 'cat-bars-pubs', parentId: null, name: 'Bars & Pubs', nameNl: 'Bars & Cafés', level: 1 },
  { id: 'cat-hardware', parentId: null, name: 'Hardware & DIY', nameNl: 'Bouwmarkt', level: 1 },
  { id: 'cat-cheese', parentId: 'cat-groceries', name: 'Cheese', nameNl: 'Kaas', level: 2 },
  { id: 'cat-baking', parentId: 'cat-groceries', name: 'Baking & Sugar', nameNl: 'Bakken & Suiker', level: 2 },
  { id: 'cat-breakfast', parentId: 'cat-groceries', name: 'Breakfast & Cereal', nameNl: 'Ontbijt & Granen', level: 2 },
  { id: 'cat-grains', parentId: 'cat-groceries', name: 'Pasta, Rice & Grains', nameNl: 'Pasta, Rijst & Granen', level: 2 },
  { id: 'cat-canned', parentId: 'cat-groceries', name: 'Canned & Jarred', nameNl: 'Conserven', level: 2 },
  { id: 'cat-condiments', parentId: 'cat-groceries', name: 'Condiments & Sauces', nameNl: 'Sauzen & Kruiden', level: 2 },
  { id: 'cat-coffee-tea', parentId: 'cat-groceries', name: 'Coffee & Tea', nameNl: 'Koffie & Thee', level: 2 },
  { id: 'cat-nuts', parentId: 'cat-groceries', name: 'Nuts & Dried Fruit', nameNl: 'Noten & Gedroogd Fruit', level: 2 },
  { id: 'cat-ready-deli', parentId: 'cat-groceries', name: 'Ready Meals & Deli', nameNl: 'Kant-en-klaar & Vleeswaren', level: 2 },
  { id: 'cat-vitamins', parentId: 'cat-personal-care', name: 'Vitamins & Supplements', nameNl: 'Vitaminen & Supplementen', level: 2 },
  { id: 'cat-skincare', parentId: 'cat-personal-care', name: 'Skin & Body Care', nameNl: 'Huid & Lichaamsverzorging', level: 2 },
  { id: 'cat-haircare', parentId: 'cat-personal-care', name: 'Hair Care', nameNl: 'Haarverzorging', level: 2 },
  { id: 'cat-cosmetics', parentId: 'cat-personal-care', name: 'Cosmetics & Makeup', nameNl: 'Cosmetica & Make-up', level: 2 },
  { id: 'cat-oralcare', parentId: 'cat-personal-care', name: 'Oral Care', nameNl: 'Mondverzorging', level: 2 },
  { id: 'cat-cleaning-supplies', parentId: 'cat-household', name: 'Cleaning Supplies', nameNl: 'Schoonmaakmiddelen', level: 2 },
  { id: 'cat-paper-goods', parentId: 'cat-household', name: 'Paper & Disposables', nameNl: 'Papier & Wegwerp', level: 2 },
  { id: 'cat-kitchen-storage', parentId: 'cat-household', name: 'Kitchen & Storage', nameNl: 'Keuken & Opslag', level: 2 },
  { id: 'cat-furniture', parentId: 'cat-home-garden', name: 'Furniture & Decor', nameNl: 'Meubels & Decoratie', level: 2 },
  { id: 'cat-tools-diy', parentId: 'cat-home-garden', name: 'Tools & DIY', nameNl: 'Gereedschap & Klussen', level: 2 },
  { id: 'cat-garden', parentId: 'cat-home-garden', name: 'Plants & Garden', nameNl: 'Planten & Tuin', level: 2 },
  { id: 'cat-medical', parentId: 'cat-health', name: 'Medical & Clinical', nameNl: 'Medisch & Klinisch', level: 2 },
  { id: 'cat-fitness', parentId: 'cat-health', name: 'Fitness & Wellness', nameNl: 'Fitness & Welzijn', level: 2 },
  { id: 'cat-optical', parentId: 'cat-health', name: 'Optical & Eyewear', nameNl: 'Optiek & Brillen', level: 2 },
  { id: 'cat-diapers', parentId: 'cat-baby', name: 'Diapers & Wipes', nameNl: 'Luiers & Doekjes', level: 2 },
  { id: 'cat-baby-food', parentId: 'cat-baby', name: 'Baby Food', nameNl: 'Babyvoeding', level: 2 },
  { id: 'cat-toys', parentId: 'cat-baby', name: 'Toys & Gear', nameNl: 'Speelgoed & Spullen', level: 2 },
  { id: 'cat-pet-food', parentId: 'cat-pet', name: 'Pet Food', nameNl: 'Dierenvoeding', level: 2 },
  { id: 'cat-pet-supplies', parentId: 'cat-pet', name: 'Pet Supplies', nameNl: 'Dierbenodigdheden', level: 2 },
  { id: 'cat-fuel', parentId: 'cat-transport', name: 'Fuel', nameNl: 'Brandstof', level: 2 },
  { id: 'cat-public-transport', parentId: 'cat-transport', name: 'Public Transport', nameNl: 'Openbaar Vervoer', level: 2 },
  { id: 'cat-parking-tolls', parentId: 'cat-transport', name: 'Parking & Tolls', nameNl: 'Parkeren & Tol', level: 2 },
  { id: 'cat-apparel', parentId: 'cat-clothing', name: 'Apparel', nameNl: 'Kleding', level: 2 },
  { id: 'cat-shoes', parentId: 'cat-clothing', name: 'Shoes', nameNl: 'Schoenen', level: 2 },
  { id: 'cat-accessories', parentId: 'cat-clothing', name: 'Accessories', nameNl: 'Accessoires', level: 2 },
  { id: 'cat-devices', parentId: 'cat-electronics', name: 'Devices', nameNl: 'Apparaten', level: 2 },
  { id: 'cat-electronics-acc', parentId: 'cat-electronics', name: 'Electronics Accessories', nameNl: 'Elektronica-accessoires', level: 2 },
  { id: 'cat-streaming', parentId: 'cat-entertainment', name: 'Streaming & Subscriptions', nameNl: 'Streaming & Abonnementen', level: 2 },
  { id: 'cat-events', parentId: 'cat-entertainment', name: 'Events & Tickets', nameNl: 'Evenementen & Tickets', level: 2 },
  { id: 'cat-games', parentId: 'cat-entertainment', name: 'Games & Hobbies', nameNl: 'Games & Hobby\'s', level: 2 },
  { id: 'cat-tools-hardware', parentId: 'cat-hardware', name: 'Tools & Hardware', nameNl: 'Gereedschap & IJzerwaren', level: 2 },
  { id: 'cat-paint', parentId: 'cat-hardware', name: 'Paint & Decorating', nameNl: 'Verf & Decoratie', level: 2 },
  { id: 'cat-building-materials', parentId: 'cat-hardware', name: 'Building Materials', nameNl: 'Bouwmaterialen', level: 2 },
  { id: 'cat-electrical-plumbing', parentId: 'cat-hardware', name: 'Electrical & Plumbing', nameNl: 'Elektra & Sanitair', level: 2 },
  { id: 'cat-fasteners', parentId: 'cat-hardware', name: 'Fasteners & Fixings', nameNl: 'Bevestigingsmaterialen', level: 2 },
  { id: 'cat-power-tools', parentId: 'cat-hardware', name: 'Power Tools', nameNl: 'Elektrisch Gereedschap', level: 2 },
  { id: 'cat-hand-tools', parentId: 'cat-hardware', name: 'Hand Tools', nameNl: 'Handgereedschap', level: 2 },
  { id: 'cat-flooring', parentId: 'cat-hardware', name: 'Flooring & Tiles', nameNl: 'Vloeren & Tegels', level: 2 },
  { id: 'cat-lumber', parentId: 'cat-hardware', name: 'Lumber & Timber', nameNl: 'Hout & Plaatmateriaal', level: 2 },
  { id: 'cat-lighting', parentId: 'cat-hardware', name: 'Lighting', nameNl: 'Verlichting', level: 2 },
  { id: 'cat-doors-windows', parentId: 'cat-hardware', name: 'Doors & Windows', nameNl: 'Deuren & Ramen', level: 2 },
  { id: 'cat-adhesives', parentId: 'cat-hardware', name: 'Adhesives & Sealants', nameNl: 'Lijm & Kit', level: 2 },
  { id: 'cat-safety-workwear', parentId: 'cat-hardware', name: 'Safety & Workwear', nameNl: 'Veiligheid & Werkkleding', level: 2 },
  { id: 'cat-garden-outdoor', parentId: 'cat-hardware', name: 'Garden & Outdoor', nameNl: 'Tuin & Buiten', level: 2 },
  { id: 'cat-kitchen-bath', parentId: 'cat-hardware', name: 'Kitchen & Bathroom', nameNl: 'Keuken & Badkamer', level: 2 },
  { id: 'cat-hvac', parentId: 'cat-hardware', name: 'Heating & Ventilation', nameNl: 'Verwarming & Ventilatie', level: 2 },
];

// Every top-level macro gets a Taxes / Bonus & Discounts / Other leaf. Generated so the
// pattern can never drift; the parity test still pins the result against the seed.
const BUCKET_MACRO_IDS = [
  'cat-groceries', 'cat-household', 'cat-personal-care', 'cat-baby', 'cat-pet',
  'cat-dining-out', 'cat-transport', 'cat-clothing', 'cat-electronics', 'cat-health',
  'cat-home-garden', 'cat-entertainment', 'cat-services', 'cat-lodging', 'cat-bars-pubs',
  'cat-hardware', 'cat-other',
];
const PER_MACRO_BUCKETS: CategoryRow[] = BUCKET_MACRO_IDS.flatMap((macroId) => [
  { id: `${macroId}-tax`, parentId: macroId, name: 'Taxes & Fees', nameNl: 'Belastingen & Toeslagen', level: 2 },
  { id: `${macroId}-discount`, parentId: macroId, name: 'Bonus & Discounts', nameNl: 'Bonus & Kortingen', level: 2 },
  { id: `${macroId}-other`, parentId: macroId, name: 'Other', nameNl: 'Overig', level: 2 },
]);

export const ADDED_CATEGORIES: CategoryRow[] = [...EXPLICIT_ADDED, ...PER_MACRO_BUCKETS];

const sqlLiteral = (value: string | null): string =>
  value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  for (const r of RENAMED_CATEGORIES) {
    pgm.sql(`UPDATE product_category SET name = ${sqlLiteral(r.name)}, name_nl = ${sqlLiteral(r.nameNl)} WHERE id = ${sqlLiteral(r.id)};`);
  }

  const rows = ADDED_CATEGORIES
    .map((c) => `(${sqlLiteral(c.id)}, ${sqlLiteral(c.parentId)}, ${sqlLiteral(c.name)}, ${sqlLiteral(c.nameNl)}, ${c.level})`)
    .join(',\n    ');
  pgm.sql(`
    INSERT INTO product_category (id, parent_id, name, name_nl, level) VALUES
    ${rows}
    ON CONFLICT (id) DO NOTHING;
  `);

  // Retire removed leaves: remap any surviving references onto the target (which the
  // INSERT above guarantees exists), then delete the now-unreferenced rows.
  for (const removedId of REMOVED_CATEGORIES) {
    for (const table of CATEGORY_FK_TABLES) {
      pgm.sql(`UPDATE ${table} SET category_id = ${sqlLiteral(REMAP_TARGET)} WHERE category_id = ${sqlLiteral(removedId)};`);
    }
    pgm.sql(`DELETE FROM product_category WHERE id = ${sqlLiteral(removedId)};`);
  }
}

// No-op down, matching the reference-data convention: these rows become FK targets for
// product / product_concept / invoice_line as soon as ingestion runs, so a DELETE would
// throw on populated stages and strand later rollbacks. up() is idempotent.
export async function down(): Promise<void> {}
