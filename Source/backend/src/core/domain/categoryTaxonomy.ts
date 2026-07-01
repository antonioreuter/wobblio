// Bundled macro/sub category taxonomy (mirrors the product_category seed). Used to
// validate LLM-assigned category ids and to enumerate choices in the §6.3/§6.4
// prompts. Kept in-process so the worker has no extra DB round-trip per receipt.

export interface CategoryDefinition {
  id: string;
  name: string;
  parentId: string | null;
}

export const CATEGORY_TAXONOMY: CategoryDefinition[] = [
  { id: 'cat-groceries', name: 'Groceries', parentId: null },
  { id: 'cat-household', name: 'Household', parentId: null },
  { id: 'cat-personal-care', name: 'Personal Care & Pharmacy', parentId: null },
  { id: 'cat-baby', name: 'Baby & Kids', parentId: null },
  { id: 'cat-pet', name: 'Pet', parentId: null },
  { id: 'cat-dining-out', name: 'Dining Out', parentId: null },
  { id: 'cat-transport', name: 'Transport & Fuel', parentId: null },
  { id: 'cat-clothing', name: 'Clothing', parentId: null },
  { id: 'cat-electronics', name: 'Electronics', parentId: null },
  { id: 'cat-health', name: 'Health', parentId: null },
  { id: 'cat-home-garden', name: 'Home & Garden', parentId: null },
  { id: 'cat-entertainment', name: 'Entertainment', parentId: null },
  { id: 'cat-services', name: 'Services', parentId: null },
  { id: 'cat-lodging', name: 'Accommodation', parentId: null },
  { id: 'cat-bars-pubs', name: 'Bars & Pubs', parentId: null },
  { id: 'cat-hardware', name: 'Hardware & DIY', parentId: null },
  { id: 'cat-other', name: 'Other', parentId: null },
  { id: 'cat-dairy', name: 'Dairy & Eggs', parentId: 'cat-groceries' },
  { id: 'cat-cheese', name: 'Cheese', parentId: 'cat-groceries' },
  { id: 'cat-produce', name: 'Fruits & Vegetables', parentId: 'cat-groceries' },
  { id: 'cat-meat-fish', name: 'Meat & Fish', parentId: 'cat-groceries' },
  { id: 'cat-bakery', name: 'Bakery', parentId: 'cat-groceries' },
  { id: 'cat-breakfast', name: 'Breakfast & Cereal', parentId: 'cat-groceries' },
  { id: 'cat-baking', name: 'Baking & Sugar', parentId: 'cat-groceries' },
  { id: 'cat-grains', name: 'Pasta, Rice & Grains', parentId: 'cat-groceries' },
  { id: 'cat-canned', name: 'Canned & Jarred', parentId: 'cat-groceries' },
  { id: 'cat-condiments', name: 'Condiments & Sauces', parentId: 'cat-groceries' },
  { id: 'cat-frozen', name: 'Frozen', parentId: 'cat-groceries' },
  { id: 'cat-beverages', name: 'Beverages', parentId: 'cat-groceries' },
  { id: 'cat-coffee-tea', name: 'Coffee & Tea', parentId: 'cat-groceries' },
  { id: 'cat-alcohol', name: 'Alcohol', parentId: 'cat-groceries' },
  { id: 'cat-snacks', name: 'Snacks & Sweets', parentId: 'cat-groceries' },
  { id: 'cat-nuts', name: 'Nuts & Dried Fruit', parentId: 'cat-groceries' },
  { id: 'cat-ready-deli', name: 'Ready Meals & Deli', parentId: 'cat-groceries' },
  { id: 'cat-pharmacy', name: 'Pharmacy', parentId: 'cat-personal-care' },
  { id: 'cat-vitamins', name: 'Vitamins & Supplements', parentId: 'cat-personal-care' },
  { id: 'cat-skincare', name: 'Skin & Body Care', parentId: 'cat-personal-care' },
  { id: 'cat-haircare', name: 'Hair Care', parentId: 'cat-personal-care' },
  { id: 'cat-cosmetics', name: 'Cosmetics & Makeup', parentId: 'cat-personal-care' },
  { id: 'cat-oralcare', name: 'Oral Care', parentId: 'cat-personal-care' },
  { id: 'cat-cleaning-supplies', name: 'Cleaning Supplies', parentId: 'cat-household' },
  { id: 'cat-paper-goods', name: 'Paper & Disposables', parentId: 'cat-household' },
  { id: 'cat-kitchen-storage', name: 'Kitchen & Storage', parentId: 'cat-household' },
  { id: 'cat-furniture', name: 'Furniture & Decor', parentId: 'cat-home-garden' },
  { id: 'cat-tools-diy', name: 'Tools & DIY', parentId: 'cat-home-garden' },
  { id: 'cat-garden', name: 'Plants & Garden', parentId: 'cat-home-garden' },
  { id: 'cat-medical', name: 'Medical & Clinical', parentId: 'cat-health' },
  { id: 'cat-fitness', name: 'Fitness & Wellness', parentId: 'cat-health' },
  { id: 'cat-optical', name: 'Optical & Eyewear', parentId: 'cat-health' },
  { id: 'cat-diapers', name: 'Diapers & Wipes', parentId: 'cat-baby' },
  { id: 'cat-baby-food', name: 'Baby Food', parentId: 'cat-baby' },
  { id: 'cat-toys', name: 'Toys & Gear', parentId: 'cat-baby' },
  { id: 'cat-pet-food', name: 'Pet Food', parentId: 'cat-pet' },
  { id: 'cat-pet-supplies', name: 'Pet Supplies', parentId: 'cat-pet' },
  { id: 'cat-fuel', name: 'Fuel', parentId: 'cat-transport' },
  { id: 'cat-public-transport', name: 'Public Transport', parentId: 'cat-transport' },
  { id: 'cat-parking-tolls', name: 'Parking & Tolls', parentId: 'cat-transport' },
  { id: 'cat-apparel', name: 'Apparel', parentId: 'cat-clothing' },
  { id: 'cat-shoes', name: 'Shoes', parentId: 'cat-clothing' },
  { id: 'cat-accessories', name: 'Accessories', parentId: 'cat-clothing' },
  { id: 'cat-devices', name: 'Devices', parentId: 'cat-electronics' },
  { id: 'cat-electronics-acc', name: 'Electronics Accessories', parentId: 'cat-electronics' },
  { id: 'cat-streaming', name: 'Streaming & Subscriptions', parentId: 'cat-entertainment' },
  { id: 'cat-events', name: 'Events & Tickets', parentId: 'cat-entertainment' },
  { id: 'cat-games', name: 'Games & Hobbies', parentId: 'cat-entertainment' },
  // Per-macro Taxes / Bonus & Discounts / Other leaves (apply to every top-level macro).
  { id: 'cat-groceries-tax', name: 'Taxes & Fees', parentId: 'cat-groceries' },
  { id: 'cat-groceries-discount', name: 'Bonus & Discounts', parentId: 'cat-groceries' },
  { id: 'cat-groceries-other', name: 'Other', parentId: 'cat-groceries' },
  { id: 'cat-household-tax', name: 'Taxes & Fees', parentId: 'cat-household' },
  { id: 'cat-household-discount', name: 'Bonus & Discounts', parentId: 'cat-household' },
  { id: 'cat-household-other', name: 'Other', parentId: 'cat-household' },
  { id: 'cat-personal-care-tax', name: 'Taxes & Fees', parentId: 'cat-personal-care' },
  { id: 'cat-personal-care-discount', name: 'Bonus & Discounts', parentId: 'cat-personal-care' },
  { id: 'cat-personal-care-other', name: 'Other', parentId: 'cat-personal-care' },
  { id: 'cat-baby-tax', name: 'Taxes & Fees', parentId: 'cat-baby' },
  { id: 'cat-baby-discount', name: 'Bonus & Discounts', parentId: 'cat-baby' },
  { id: 'cat-baby-other', name: 'Other', parentId: 'cat-baby' },
  { id: 'cat-pet-tax', name: 'Taxes & Fees', parentId: 'cat-pet' },
  { id: 'cat-pet-discount', name: 'Bonus & Discounts', parentId: 'cat-pet' },
  { id: 'cat-pet-other', name: 'Other', parentId: 'cat-pet' },
  { id: 'cat-dining-out-tax', name: 'Taxes & Fees', parentId: 'cat-dining-out' },
  { id: 'cat-dining-out-discount', name: 'Bonus & Discounts', parentId: 'cat-dining-out' },
  { id: 'cat-dining-out-other', name: 'Other', parentId: 'cat-dining-out' },
  { id: 'cat-transport-tax', name: 'Taxes & Fees', parentId: 'cat-transport' },
  { id: 'cat-transport-discount', name: 'Bonus & Discounts', parentId: 'cat-transport' },
  { id: 'cat-transport-other', name: 'Other', parentId: 'cat-transport' },
  { id: 'cat-clothing-tax', name: 'Taxes & Fees', parentId: 'cat-clothing' },
  { id: 'cat-clothing-discount', name: 'Bonus & Discounts', parentId: 'cat-clothing' },
  { id: 'cat-clothing-other', name: 'Other', parentId: 'cat-clothing' },
  { id: 'cat-electronics-tax', name: 'Taxes & Fees', parentId: 'cat-electronics' },
  { id: 'cat-electronics-discount', name: 'Bonus & Discounts', parentId: 'cat-electronics' },
  { id: 'cat-electronics-other', name: 'Other', parentId: 'cat-electronics' },
  { id: 'cat-health-tax', name: 'Taxes & Fees', parentId: 'cat-health' },
  { id: 'cat-health-discount', name: 'Bonus & Discounts', parentId: 'cat-health' },
  { id: 'cat-health-other', name: 'Other', parentId: 'cat-health' },
  { id: 'cat-home-garden-tax', name: 'Taxes & Fees', parentId: 'cat-home-garden' },
  { id: 'cat-home-garden-discount', name: 'Bonus & Discounts', parentId: 'cat-home-garden' },
  { id: 'cat-home-garden-other', name: 'Other', parentId: 'cat-home-garden' },
  { id: 'cat-entertainment-tax', name: 'Taxes & Fees', parentId: 'cat-entertainment' },
  { id: 'cat-entertainment-discount', name: 'Bonus & Discounts', parentId: 'cat-entertainment' },
  { id: 'cat-entertainment-other', name: 'Other', parentId: 'cat-entertainment' },
  { id: 'cat-services-tax', name: 'Taxes & Fees', parentId: 'cat-services' },
  { id: 'cat-services-discount', name: 'Bonus & Discounts', parentId: 'cat-services' },
  { id: 'cat-services-other', name: 'Other', parentId: 'cat-services' },
  { id: 'cat-lodging-tax', name: 'Taxes & Fees', parentId: 'cat-lodging' },
  { id: 'cat-lodging-discount', name: 'Bonus & Discounts', parentId: 'cat-lodging' },
  { id: 'cat-lodging-other', name: 'Other', parentId: 'cat-lodging' },
  { id: 'cat-bars-pubs-tax', name: 'Taxes & Fees', parentId: 'cat-bars-pubs' },
  { id: 'cat-bars-pubs-discount', name: 'Bonus & Discounts', parentId: 'cat-bars-pubs' },
  { id: 'cat-bars-pubs-other', name: 'Other', parentId: 'cat-bars-pubs' },
  { id: 'cat-other-tax', name: 'Taxes & Fees', parentId: 'cat-other' },
  { id: 'cat-other-discount', name: 'Bonus & Discounts', parentId: 'cat-other' },
  { id: 'cat-other-other', name: 'Other', parentId: 'cat-other' },
  // Hardware & DIY content sub-categories.
  { id: 'cat-tools-hardware', name: 'Tools & Hardware', parentId: 'cat-hardware' },
  { id: 'cat-paint', name: 'Paint & Decorating', parentId: 'cat-hardware' },
  { id: 'cat-building-materials', name: 'Building Materials', parentId: 'cat-hardware' },
  { id: 'cat-electrical-plumbing', name: 'Electrical & Plumbing', parentId: 'cat-hardware' },
  { id: 'cat-fasteners', name: 'Fasteners & Fixings', parentId: 'cat-hardware' },
  { id: 'cat-power-tools', name: 'Power Tools', parentId: 'cat-hardware' },
  { id: 'cat-hand-tools', name: 'Hand Tools', parentId: 'cat-hardware' },
  { id: 'cat-flooring', name: 'Flooring & Tiles', parentId: 'cat-hardware' },
  { id: 'cat-lumber', name: 'Lumber & Timber', parentId: 'cat-hardware' },
  { id: 'cat-lighting', name: 'Lighting', parentId: 'cat-hardware' },
  { id: 'cat-doors-windows', name: 'Doors & Windows', parentId: 'cat-hardware' },
  { id: 'cat-adhesives', name: 'Adhesives & Sealants', parentId: 'cat-hardware' },
  { id: 'cat-safety-workwear', name: 'Safety & Workwear', parentId: 'cat-hardware' },
  { id: 'cat-garden-outdoor', name: 'Garden & Outdoor', parentId: 'cat-hardware' },
  { id: 'cat-kitchen-bath', name: 'Kitchen & Bathroom', parentId: 'cat-hardware' },
  { id: 'cat-hvac', name: 'Heating & Ventilation', parentId: 'cat-hardware' },
  { id: 'cat-hardware-tax', name: 'Taxes & Fees', parentId: 'cat-hardware' },
  { id: 'cat-hardware-discount', name: 'Bonus & Discounts', parentId: 'cat-hardware' },
  { id: 'cat-hardware-other', name: 'Other', parentId: 'cat-hardware' },
  // Per-macro Deposits & Returns leaves (statiegeld / container deposits).
  { id: 'cat-groceries-deposit', name: 'Deposits & Returns', parentId: 'cat-groceries' },
  { id: 'cat-household-deposit', name: 'Deposits & Returns', parentId: 'cat-household' },
  { id: 'cat-personal-care-deposit', name: 'Deposits & Returns', parentId: 'cat-personal-care' },
  { id: 'cat-baby-deposit', name: 'Deposits & Returns', parentId: 'cat-baby' },
  { id: 'cat-pet-deposit', name: 'Deposits & Returns', parentId: 'cat-pet' },
  { id: 'cat-dining-out-deposit', name: 'Deposits & Returns', parentId: 'cat-dining-out' },
  { id: 'cat-transport-deposit', name: 'Deposits & Returns', parentId: 'cat-transport' },
  { id: 'cat-clothing-deposit', name: 'Deposits & Returns', parentId: 'cat-clothing' },
  { id: 'cat-electronics-deposit', name: 'Deposits & Returns', parentId: 'cat-electronics' },
  { id: 'cat-health-deposit', name: 'Deposits & Returns', parentId: 'cat-health' },
  { id: 'cat-home-garden-deposit', name: 'Deposits & Returns', parentId: 'cat-home-garden' },
  { id: 'cat-entertainment-deposit', name: 'Deposits & Returns', parentId: 'cat-entertainment' },
  { id: 'cat-services-deposit', name: 'Deposits & Returns', parentId: 'cat-services' },
  { id: 'cat-lodging-deposit', name: 'Deposits & Returns', parentId: 'cat-lodging' },
  { id: 'cat-bars-pubs-deposit', name: 'Deposits & Returns', parentId: 'cat-bars-pubs' },
  { id: 'cat-hardware-deposit', name: 'Deposits & Returns', parentId: 'cat-hardware' },
  { id: 'cat-other-deposit', name: 'Deposits & Returns', parentId: 'cat-other' },
];

export const CATEGORY_IDS: ReadonlySet<string> = new Set(CATEGORY_TAXONOMY.map(c => c.id));

export const DINING_OUT_CATEGORY_ID = 'cat-dining-out';

export function isValidCategoryId(id: string): boolean {
  return CATEGORY_IDS.has(id);
}

const NAME_BY_ID = new Map<string, string>(CATEGORY_TAXONOMY.map(c => [c.id, c.name]));

// Resolve a category id to its human-readable display name for the UI. Unknown or
// null ids return null so the caller can fall back.
export function categoryNameFor(id: string | null): string | null {
  return id ? NAME_BY_ID.get(id) ?? null : null;
}

const PARENT_BY_ID = new Map<string, string | null>(CATEGORY_TAXONOMY.map(c => [c.id, c.parentId]));

// Roll a (possibly sub-) category up to its top-level macro. The taxonomy is two
// levels deep, so a leaf's parent is always a macro; unknown ids pass through.
export function macroCategoryId(id: string): string {
  return PARENT_BY_ID.get(id) ?? id;
}

// The macro id itself plus every leaf under it — the set a "products in this
// macro" filter (e.g. shopping-list category lock, §10b) must match against,
// since a product can be tagged with either the macro or one of its leaves.
export function categoryIdsUnderMacro(macroId: string): string[] {
  return [macroId, ...CATEGORY_TAXONOMY.filter(c => c.parentId === macroId).map(c => c.id)];
}

// Deterministic structural buckets: a deposit/discount line's displayed category must
// not depend on the LLM's guess. Map to the matching per-macro leaf, falling back to
// the cat-other leaf when the line's macro can't be resolved to a real bucket.
export function depositCategoryFor(categoryId: string | null): string {
  return leafForMacro(categoryId, 'deposit');
}

export function discountCategoryFor(categoryId: string | null): string {
  return leafForMacro(categoryId, 'discount');
}

function leafForMacro(categoryId: string | null, leaf: 'deposit' | 'discount'): string {
  const candidate = categoryId ? `${macroCategoryId(categoryId)}-${leaf}` : null;
  return candidate && isValidCategoryId(candidate) ? candidate : `cat-other-${leaf}`;
}
