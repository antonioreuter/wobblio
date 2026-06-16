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
  { id: 'cat-other', name: 'Other', parentId: null },
  { id: 'cat-dairy', name: 'Dairy & Eggs', parentId: 'cat-groceries' },
  { id: 'cat-produce', name: 'Produce', parentId: 'cat-groceries' },
  { id: 'cat-meat-fish', name: 'Meat & Fish', parentId: 'cat-groceries' },
  { id: 'cat-bakery', name: 'Bakery', parentId: 'cat-groceries' },
  { id: 'cat-pantry', name: 'Pantry', parentId: 'cat-groceries' },
  { id: 'cat-frozen', name: 'Frozen', parentId: 'cat-groceries' },
  { id: 'cat-beverages', name: 'Beverages', parentId: 'cat-groceries' },
  { id: 'cat-alcohol', name: 'Alcohol', parentId: 'cat-groceries' },
  { id: 'cat-snacks', name: 'Snacks & Sweets', parentId: 'cat-groceries' },
  { id: 'cat-pharmacy', name: 'Pharmacy', parentId: 'cat-personal-care' },
];

export const CATEGORY_IDS: ReadonlySet<string> = new Set(CATEGORY_TAXONOMY.map(c => c.id));

export const DINING_OUT_CATEGORY_ID = 'cat-dining-out';

export function isValidCategoryId(id: string): boolean {
  return CATEGORY_IDS.has(id);
}

const PARENT_BY_ID = new Map<string, string | null>(CATEGORY_TAXONOMY.map(c => [c.id, c.parentId]));

// Roll a (possibly sub-) category up to its top-level macro. The taxonomy is two
// levels deep, so a leaf's parent is always a macro; unknown ids pass through.
export function macroCategoryId(id: string): string {
  return PARENT_BY_ID.get(id) ?? id;
}
