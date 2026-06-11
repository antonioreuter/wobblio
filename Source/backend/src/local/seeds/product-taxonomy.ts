export interface CategorySeed {
  id: string;
  parent_id: string | null;
  name: string;
  name_nl: string;
  level: number;
}

export const categorySeed: CategorySeed[] = [
  // ── Top-level (level 1) ────────────────────────────────────────────────────
  { id: 'cat-groceries',        parent_id: null, name: 'Groceries',                   name_nl: 'Boodschappen',            level: 1 },
  { id: 'cat-household',        parent_id: null, name: 'Household',                   name_nl: 'Huishouden',              level: 1 },
  { id: 'cat-personal-care',    parent_id: null, name: 'Personal Care & Pharmacy',    name_nl: 'Persoonlijke verzorging', level: 1 },
  { id: 'cat-baby',             parent_id: null, name: 'Baby & Kids',                 name_nl: 'Baby & Kids',             level: 1 },
  { id: 'cat-pet',              parent_id: null, name: 'Pet',                         name_nl: 'Huisdier',                level: 1 },
  { id: 'cat-dining-out',       parent_id: null, name: 'Dining Out',                  name_nl: 'Uit eten',                level: 1 },
  { id: 'cat-transport',        parent_id: null, name: 'Transport & Fuel',            name_nl: 'Transport & Brandstof',   level: 1 },
  { id: 'cat-clothing',         parent_id: null, name: 'Clothing',                    name_nl: 'Kleding',                 level: 1 },
  { id: 'cat-electronics',      parent_id: null, name: 'Electronics',                 name_nl: 'Elektronica',             level: 1 },
  { id: 'cat-health',           parent_id: null, name: 'Health',                      name_nl: 'Gezondheid',              level: 1 },
  { id: 'cat-home-garden',      parent_id: null, name: 'Home & Garden',               name_nl: 'Huis & Tuin',             level: 1 },
  { id: 'cat-entertainment',    parent_id: null, name: 'Entertainment',               name_nl: 'Entertainment',           level: 1 },
  { id: 'cat-services',         parent_id: null, name: 'Services',                    name_nl: 'Diensten',                level: 1 },
  { id: 'cat-other',            parent_id: null, name: 'Other',                       name_nl: 'Overig',                  level: 1 },

  // ── Groceries sub-categories (level 2) ────────────────────────────────────
  { id: 'cat-dairy',            parent_id: 'cat-groceries', name: 'Dairy & Eggs',      name_nl: 'Zuivel & Eieren',       level: 2 },
  { id: 'cat-produce',          parent_id: 'cat-groceries', name: 'Produce',            name_nl: 'Groente & Fruit',       level: 2 },
  { id: 'cat-meat-fish',        parent_id: 'cat-groceries', name: 'Meat & Fish',        name_nl: 'Vlees & Vis',           level: 2 },
  { id: 'cat-bakery',           parent_id: 'cat-groceries', name: 'Bakery',             name_nl: 'Bakkerij',              level: 2 },
  { id: 'cat-pantry',           parent_id: 'cat-groceries', name: 'Pantry',             name_nl: 'Droogwaren',            level: 2 },
  { id: 'cat-frozen',           parent_id: 'cat-groceries', name: 'Frozen',             name_nl: 'Diepvries',             level: 2 },
  { id: 'cat-beverages',        parent_id: 'cat-groceries', name: 'Beverages',          name_nl: 'Dranken',               level: 2 },
  { id: 'cat-alcohol',          parent_id: 'cat-groceries', name: 'Alcohol',            name_nl: 'Alcohol',               level: 2 },
  { id: 'cat-snacks',           parent_id: 'cat-groceries', name: 'Snacks & Sweets',    name_nl: 'Snacks & Snoep',        level: 2 },

  // ── Personal Care sub-categories (level 2) ────────────────────────────────
  { id: 'cat-pharmacy',         parent_id: 'cat-personal-care', name: 'Pharmacy',      name_nl: 'Apotheek',              level: 2 },
];
