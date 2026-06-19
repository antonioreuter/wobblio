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
  { id: 'cat-lodging',          parent_id: null, name: 'Accommodation',               name_nl: 'Accommodatie',            level: 1 },
  { id: 'cat-bars-pubs',        parent_id: null, name: 'Bars & Pubs',                 name_nl: 'Bars & Cafés',            level: 1 },
  { id: 'cat-hardware',         parent_id: null, name: 'Hardware & DIY',              name_nl: 'Bouwmarkt',               level: 1 },
  { id: 'cat-other',            parent_id: null, name: 'Other',                       name_nl: 'Overig',                  level: 1 },

  // ── Groceries sub-categories (level 2) ────────────────────────────────────
  { id: 'cat-dairy',            parent_id: 'cat-groceries', name: 'Dairy & Eggs',         name_nl: 'Zuivel & Eieren',            level: 2 },
  { id: 'cat-cheese',           parent_id: 'cat-groceries', name: 'Cheese',               name_nl: 'Kaas',                       level: 2 },
  { id: 'cat-produce',          parent_id: 'cat-groceries', name: 'Fruits & Vegetables',  name_nl: 'Groente & Fruit',            level: 2 },
  { id: 'cat-meat-fish',        parent_id: 'cat-groceries', name: 'Meat & Fish',          name_nl: 'Vlees & Vis',                level: 2 },
  { id: 'cat-bakery',           parent_id: 'cat-groceries', name: 'Bakery',               name_nl: 'Bakkerij',                   level: 2 },
  { id: 'cat-breakfast',        parent_id: 'cat-groceries', name: 'Breakfast & Cereal',   name_nl: 'Ontbijt & Granen',           level: 2 },
  { id: 'cat-baking',           parent_id: 'cat-groceries', name: 'Baking & Sugar',       name_nl: 'Bakken & Suiker',            level: 2 },
  { id: 'cat-grains',           parent_id: 'cat-groceries', name: 'Pasta, Rice & Grains', name_nl: 'Pasta, Rijst & Granen',      level: 2 },
  { id: 'cat-canned',           parent_id: 'cat-groceries', name: 'Canned & Jarred',      name_nl: 'Conserven',                  level: 2 },
  { id: 'cat-condiments',       parent_id: 'cat-groceries', name: 'Condiments & Sauces',  name_nl: 'Sauzen & Kruiden',           level: 2 },
  { id: 'cat-frozen',           parent_id: 'cat-groceries', name: 'Frozen',               name_nl: 'Diepvries',                  level: 2 },
  { id: 'cat-beverages',        parent_id: 'cat-groceries', name: 'Beverages',            name_nl: 'Dranken',                    level: 2 },
  { id: 'cat-coffee-tea',       parent_id: 'cat-groceries', name: 'Coffee & Tea',         name_nl: 'Koffie & Thee',              level: 2 },
  { id: 'cat-alcohol',          parent_id: 'cat-groceries', name: 'Alcohol',              name_nl: 'Alcohol',                    level: 2 },
  { id: 'cat-snacks',           parent_id: 'cat-groceries', name: 'Snacks & Sweets',      name_nl: 'Snacks & Snoep',             level: 2 },
  { id: 'cat-nuts',             parent_id: 'cat-groceries', name: 'Nuts & Dried Fruit',   name_nl: 'Noten & Gedroogd Fruit',     level: 2 },
  { id: 'cat-ready-deli',       parent_id: 'cat-groceries', name: 'Ready Meals & Deli',   name_nl: 'Kant-en-klaar & Vleeswaren', level: 2 },

  // ── Personal Care & Pharmacy sub-categories (level 2) ─────────────────────
  { id: 'cat-pharmacy',         parent_id: 'cat-personal-care', name: 'Pharmacy',                 name_nl: 'Apotheek',                    level: 2 },
  { id: 'cat-vitamins',         parent_id: 'cat-personal-care', name: 'Vitamins & Supplements',   name_nl: 'Vitaminen & Supplementen',    level: 2 },
  { id: 'cat-skincare',         parent_id: 'cat-personal-care', name: 'Skin & Body Care',         name_nl: 'Huid & Lichaamsverzorging',   level: 2 },
  { id: 'cat-haircare',         parent_id: 'cat-personal-care', name: 'Hair Care',                name_nl: 'Haarverzorging',              level: 2 },
  { id: 'cat-cosmetics',        parent_id: 'cat-personal-care', name: 'Cosmetics & Makeup',       name_nl: 'Cosmetica & Make-up',         level: 2 },
  { id: 'cat-oralcare',         parent_id: 'cat-personal-care', name: 'Oral Care',                name_nl: 'Mondverzorging',              level: 2 },

  // ── Household sub-categories (level 2) ────────────────────────────────────
  { id: 'cat-cleaning-supplies', parent_id: 'cat-household', name: 'Cleaning Supplies',           name_nl: 'Schoonmaakmiddelen',          level: 2 },
  { id: 'cat-paper-goods',      parent_id: 'cat-household', name: 'Paper & Disposables',          name_nl: 'Papier & Wegwerp',            level: 2 },
  { id: 'cat-kitchen-storage',  parent_id: 'cat-household', name: 'Kitchen & Storage',            name_nl: 'Keuken & Opslag',             level: 2 },

  // ── Home & Garden sub-categories (level 2) ────────────────────────────────
  { id: 'cat-furniture',        parent_id: 'cat-home-garden', name: 'Furniture & Decor',          name_nl: 'Meubels & Decoratie',         level: 2 },
  { id: 'cat-tools-diy',        parent_id: 'cat-home-garden', name: 'Tools & DIY',                name_nl: 'Gereedschap & Klussen',       level: 2 },
  { id: 'cat-garden',           parent_id: 'cat-home-garden', name: 'Plants & Garden',            name_nl: 'Planten & Tuin',              level: 2 },

  // ── Health sub-categories (level 2) ───────────────────────────────────────
  { id: 'cat-medical',          parent_id: 'cat-health', name: 'Medical & Clinical',              name_nl: 'Medisch & Klinisch',          level: 2 },
  { id: 'cat-fitness',          parent_id: 'cat-health', name: 'Fitness & Wellness',              name_nl: 'Fitness & Welzijn',           level: 2 },
  { id: 'cat-optical',          parent_id: 'cat-health', name: 'Optical & Eyewear',               name_nl: 'Optiek & Brillen',            level: 2 },

  // ── Baby & Kids sub-categories (level 2) ──────────────────────────────────
  { id: 'cat-diapers',          parent_id: 'cat-baby', name: 'Diapers & Wipes',                   name_nl: 'Luiers & Doekjes',            level: 2 },
  { id: 'cat-baby-food',        parent_id: 'cat-baby', name: 'Baby Food',                         name_nl: 'Babyvoeding',                 level: 2 },
  { id: 'cat-toys',             parent_id: 'cat-baby', name: 'Toys & Gear',                       name_nl: 'Speelgoed & Spullen',         level: 2 },

  // ── Pet sub-categories (level 2) ──────────────────────────────────────────
  { id: 'cat-pet-food',         parent_id: 'cat-pet', name: 'Pet Food',                           name_nl: 'Dierenvoeding',               level: 2 },
  { id: 'cat-pet-supplies',     parent_id: 'cat-pet', name: 'Pet Supplies',                       name_nl: 'Dierbenodigdheden',           level: 2 },

  // ── Transport & Fuel sub-categories (level 2) ─────────────────────────────
  { id: 'cat-fuel',             parent_id: 'cat-transport', name: 'Fuel',                         name_nl: 'Brandstof',                   level: 2 },
  { id: 'cat-public-transport', parent_id: 'cat-transport', name: 'Public Transport',             name_nl: 'Openbaar Vervoer',            level: 2 },
  { id: 'cat-parking-tolls',    parent_id: 'cat-transport', name: 'Parking & Tolls',              name_nl: 'Parkeren & Tol',              level: 2 },

  // ── Clothing sub-categories (level 2) ─────────────────────────────────────
  { id: 'cat-apparel',          parent_id: 'cat-clothing', name: 'Apparel',                       name_nl: 'Kleding',                     level: 2 },
  { id: 'cat-shoes',            parent_id: 'cat-clothing', name: 'Shoes',                         name_nl: 'Schoenen',                    level: 2 },
  { id: 'cat-accessories',      parent_id: 'cat-clothing', name: 'Accessories',                   name_nl: 'Accessoires',                 level: 2 },

  // ── Electronics sub-categories (level 2) ──────────────────────────────────
  { id: 'cat-devices',          parent_id: 'cat-electronics', name: 'Devices',                    name_nl: 'Apparaten',                   level: 2 },
  { id: 'cat-electronics-acc',  parent_id: 'cat-electronics', name: 'Electronics Accessories',    name_nl: 'Elektronica-accessoires',     level: 2 },

  // ── Entertainment sub-categories (level 2) ────────────────────────────────
  { id: 'cat-streaming',        parent_id: 'cat-entertainment', name: 'Streaming & Subscriptions', name_nl: 'Streaming & Abonnementen',   level: 2 },
  { id: 'cat-events',           parent_id: 'cat-entertainment', name: 'Events & Tickets',          name_nl: 'Evenementen & Tickets',       level: 2 },
  { id: 'cat-games',            parent_id: 'cat-entertainment', name: 'Games & Hobbies',           name_nl: 'Games & Hobby\'s',            level: 2 },

  // ── Per-macro Taxes / Bonus & Discounts / Other leaves (level 2) ──────────
  { id: 'cat-groceries-tax',        parent_id: 'cat-groceries',     name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-groceries-discount',   parent_id: 'cat-groceries',     name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-groceries-other',      parent_id: 'cat-groceries',     name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-household-tax',        parent_id: 'cat-household',     name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-household-discount',   parent_id: 'cat-household',     name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-household-other',      parent_id: 'cat-household',     name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-personal-care-tax',      parent_id: 'cat-personal-care', name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-personal-care-discount', parent_id: 'cat-personal-care', name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-personal-care-other',    parent_id: 'cat-personal-care', name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-baby-tax',        parent_id: 'cat-baby',          name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-baby-discount',   parent_id: 'cat-baby',          name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-baby-other',      parent_id: 'cat-baby',          name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-pet-tax',        parent_id: 'cat-pet',           name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-pet-discount',   parent_id: 'cat-pet',           name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-pet-other',      parent_id: 'cat-pet',           name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-dining-out-tax',        parent_id: 'cat-dining-out',    name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-dining-out-discount',   parent_id: 'cat-dining-out',    name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-dining-out-other',      parent_id: 'cat-dining-out',    name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-transport-tax',        parent_id: 'cat-transport',     name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-transport-discount',   parent_id: 'cat-transport',     name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-transport-other',      parent_id: 'cat-transport',     name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-clothing-tax',        parent_id: 'cat-clothing',      name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-clothing-discount',   parent_id: 'cat-clothing',      name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-clothing-other',      parent_id: 'cat-clothing',      name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-electronics-tax',        parent_id: 'cat-electronics',   name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-electronics-discount',   parent_id: 'cat-electronics',   name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-electronics-other',      parent_id: 'cat-electronics',   name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-health-tax',        parent_id: 'cat-health',        name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-health-discount',   parent_id: 'cat-health',        name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-health-other',      parent_id: 'cat-health',        name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-home-garden-tax',        parent_id: 'cat-home-garden',   name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-home-garden-discount',   parent_id: 'cat-home-garden',   name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-home-garden-other',      parent_id: 'cat-home-garden',   name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-entertainment-tax',        parent_id: 'cat-entertainment', name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-entertainment-discount',   parent_id: 'cat-entertainment', name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-entertainment-other',      parent_id: 'cat-entertainment', name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-services-tax',        parent_id: 'cat-services',      name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-services-discount',   parent_id: 'cat-services',      name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-services-other',      parent_id: 'cat-services',      name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-lodging-tax',        parent_id: 'cat-lodging',       name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-lodging-discount',   parent_id: 'cat-lodging',       name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-lodging-other',      parent_id: 'cat-lodging',       name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-bars-pubs-tax',        parent_id: 'cat-bars-pubs',     name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-bars-pubs-discount',   parent_id: 'cat-bars-pubs',     name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-bars-pubs-other',      parent_id: 'cat-bars-pubs',     name: 'Other',             name_nl: 'Overig',                  level: 2 },
  { id: 'cat-other-tax',        parent_id: 'cat-other',         name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-other-discount',   parent_id: 'cat-other',         name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-other-other',      parent_id: 'cat-other',         name: 'Other',             name_nl: 'Overig',                  level: 2 },

  // ── Hardware & DIY sub-categories (level 2) ───────────────────────────────
  { id: 'cat-tools-hardware',      parent_id: 'cat-hardware', name: 'Tools & Hardware',     name_nl: 'Gereedschap & IJzerwaren', level: 2 },
  { id: 'cat-paint',               parent_id: 'cat-hardware', name: 'Paint & Decorating',   name_nl: 'Verf & Decoratie',         level: 2 },
  { id: 'cat-building-materials',  parent_id: 'cat-hardware', name: 'Building Materials',   name_nl: 'Bouwmaterialen',           level: 2 },
  { id: 'cat-electrical-plumbing', parent_id: 'cat-hardware', name: 'Electrical & Plumbing', name_nl: 'Elektra & Sanitair',      level: 2 },
  { id: 'cat-fasteners',           parent_id: 'cat-hardware', name: 'Fasteners & Fixings',  name_nl: 'Bevestigingsmaterialen', level: 2 },
  { id: 'cat-power-tools',         parent_id: 'cat-hardware', name: 'Power Tools',          name_nl: 'Elektrisch Gereedschap', level: 2 },
  { id: 'cat-hand-tools',          parent_id: 'cat-hardware', name: 'Hand Tools',           name_nl: 'Handgereedschap',        level: 2 },
  { id: 'cat-flooring',            parent_id: 'cat-hardware', name: 'Flooring & Tiles',     name_nl: 'Vloeren & Tegels',       level: 2 },
  { id: 'cat-lumber',              parent_id: 'cat-hardware', name: 'Lumber & Timber',      name_nl: 'Hout & Plaatmateriaal',  level: 2 },
  { id: 'cat-lighting',            parent_id: 'cat-hardware', name: 'Lighting',             name_nl: 'Verlichting',            level: 2 },
  { id: 'cat-doors-windows',       parent_id: 'cat-hardware', name: 'Doors & Windows',      name_nl: 'Deuren & Ramen',         level: 2 },
  { id: 'cat-adhesives',           parent_id: 'cat-hardware', name: 'Adhesives & Sealants', name_nl: 'Lijm & Kit',             level: 2 },
  { id: 'cat-safety-workwear',     parent_id: 'cat-hardware', name: 'Safety & Workwear',    name_nl: 'Veiligheid & Werkkleding', level: 2 },
  { id: 'cat-garden-outdoor',      parent_id: 'cat-hardware', name: 'Garden & Outdoor',     name_nl: 'Tuin & Buiten',          level: 2 },
  { id: 'cat-kitchen-bath',        parent_id: 'cat-hardware', name: 'Kitchen & Bathroom',   name_nl: 'Keuken & Badkamer',      level: 2 },
  { id: 'cat-hvac',                parent_id: 'cat-hardware', name: 'Heating & Ventilation', name_nl: 'Verwarming & Ventilatie', level: 2 },
  { id: 'cat-hardware-tax',        parent_id: 'cat-hardware', name: 'Taxes & Fees',      name_nl: 'Belastingen & Toeslagen', level: 2 },
  { id: 'cat-hardware-discount',   parent_id: 'cat-hardware', name: 'Bonus & Discounts', name_nl: 'Bonus & Kortingen',       level: 2 },
  { id: 'cat-hardware-other',      parent_id: 'cat-hardware', name: 'Other',             name_nl: 'Overig',                  level: 2 },

  // ── Per-macro Deposits & Returns leaves (level 2) — statiegeld / container deposits ──
  { id: 'cat-groceries-deposit',     parent_id: 'cat-groceries',     name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-household-deposit',     parent_id: 'cat-household',     name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-personal-care-deposit', parent_id: 'cat-personal-care', name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-baby-deposit',          parent_id: 'cat-baby',          name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-pet-deposit',           parent_id: 'cat-pet',           name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-dining-out-deposit',    parent_id: 'cat-dining-out',    name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-transport-deposit',     parent_id: 'cat-transport',     name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-clothing-deposit',      parent_id: 'cat-clothing',      name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-electronics-deposit',   parent_id: 'cat-electronics',   name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-health-deposit',        parent_id: 'cat-health',        name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-home-garden-deposit',   parent_id: 'cat-home-garden',   name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-entertainment-deposit', parent_id: 'cat-entertainment', name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-services-deposit',      parent_id: 'cat-services',      name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-lodging-deposit',       parent_id: 'cat-lodging',       name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-bars-pubs-deposit',     parent_id: 'cat-bars-pubs',     name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-hardware-deposit',      parent_id: 'cat-hardware',      name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
  { id: 'cat-other-deposit',         parent_id: 'cat-other',         name: 'Deposits & Returns', name_nl: 'Statiegeld & Retour', level: 2 },
];
