// Bundled, in-process tag vocabulary (§6.10). Tag keys are language-neutral slugs;
// display names are localized. Deterministic trigger maps drive auto-tagging; the
// LLM may additionally suggest keys from this same closed set. NOT sourced from SSM
// at runtime — see Epic 08 decision #4 and the parked multilingual draft spec.

export interface TagTrigger {
  categoryId?: string;
  merchantBrand?: string;
  minSpendShare?: number;
}

export interface TagDefinition {
  key: string;
  displayNameEn: string;
  displayNameNl: string;
  triggers: TagTrigger[];
}

export const TAG_VOCABULARY: TagDefinition[] = [
  { key: 'weekly-groceries', displayNameEn: 'Weekly groceries', displayNameNl: 'Weekboodschappen', triggers: [{ categoryId: 'cat-groceries', minSpendShare: 0.6 }] },
  { key: 'organic', displayNameEn: 'Organic', displayNameNl: 'Biologisch', triggers: [{ categoryId: 'cat-dairy' }, { categoryId: 'cat-produce' }] },
  { key: 'frozen-foods', displayNameEn: 'Frozen foods', displayNameNl: 'Diepvriesproducten', triggers: [{ categoryId: 'cat-frozen' }] },
  { key: 'snacks', displayNameEn: 'Snacks', displayNameNl: 'Snacks', triggers: [{ categoryId: 'cat-snacks' }] },
  { key: 'beverages', displayNameEn: 'Beverages', displayNameNl: 'Dranken', triggers: [{ categoryId: 'cat-beverages' }] },
  { key: 'alcohol', displayNameEn: 'Alcohol', displayNameNl: 'Alcohol', triggers: [{ categoryId: 'cat-alcohol' }] },
  { key: 'bakery', displayNameEn: 'Bakery', displayNameNl: 'Bakkerij', triggers: [{ categoryId: 'cat-bakery' }] },
  { key: 'dairy', displayNameEn: 'Dairy', displayNameNl: 'Zuivel', triggers: [{ categoryId: 'cat-dairy' }] },
  { key: 'produce', displayNameEn: 'Produce', displayNameNl: 'Groente & Fruit', triggers: [{ categoryId: 'cat-produce' }] },
  { key: 'meat-fish', displayNameEn: 'Meat & Fish', displayNameNl: 'Vlees & Vis', triggers: [{ categoryId: 'cat-meat-fish' }] },
  { key: 'pantry', displayNameEn: 'Pantry staples', displayNameNl: 'Voorraadkast', triggers: [{ categoryId: 'cat-pantry' }] },
  { key: 'household-supplies', displayNameEn: 'Household supplies', displayNameNl: 'Huishoudartikelen', triggers: [{ categoryId: 'cat-household' }] },
  { key: 'cleaning', displayNameEn: 'Cleaning', displayNameNl: 'Schoonmaak', triggers: [{ categoryId: 'cat-household', minSpendShare: 0.2 }] },
  { key: 'personal-care', displayNameEn: 'Personal care', displayNameNl: 'Persoonlijke verzorging', triggers: [{ categoryId: 'cat-personal-care' }] },
  { key: 'pharmacy', displayNameEn: 'Pharmacy', displayNameNl: 'Apotheek', triggers: [{ categoryId: 'cat-pharmacy' }] },
  { key: 'baby-care', displayNameEn: 'Baby care', displayNameNl: 'Babyverzorging', triggers: [{ categoryId: 'cat-baby' }] },
  { key: 'pet-food', displayNameEn: 'Pet food', displayNameNl: 'Dierenvoeding', triggers: [{ categoryId: 'cat-pet' }] },
  { key: 'dining-out', displayNameEn: 'Dining out', displayNameNl: 'Uit eten', triggers: [{ categoryId: 'cat-dining-out' }] },
  { key: 'takeaway', displayNameEn: 'Takeaway', displayNameNl: 'Afhalen', triggers: [{ categoryId: 'cat-dining-out', minSpendShare: 0.5 }] },
  { key: 'fuel', displayNameEn: 'Fuel', displayNameNl: 'Brandstof', triggers: [{ categoryId: 'cat-transport' }] },
  { key: 'transport', displayNameEn: 'Transport', displayNameNl: 'Transport', triggers: [{ categoryId: 'cat-transport' }] },
  { key: 'clothing', displayNameEn: 'Clothing', displayNameNl: 'Kleding', triggers: [{ categoryId: 'cat-clothing' }] },
  { key: 'electronics', displayNameEn: 'Electronics', displayNameNl: 'Elektronica', triggers: [{ categoryId: 'cat-electronics' }] },
  { key: 'health', displayNameEn: 'Health', displayNameNl: 'Gezondheid', triggers: [{ categoryId: 'cat-health' }] },
  { key: 'home-garden', displayNameEn: 'Home & Garden', displayNameNl: 'Huis & Tuin', triggers: [{ categoryId: 'cat-home-garden' }] },
  { key: 'entertainment', displayNameEn: 'Entertainment', displayNameNl: 'Entertainment', triggers: [{ categoryId: 'cat-entertainment' }] },
  { key: 'services', displayNameEn: 'Services', displayNameNl: 'Diensten', triggers: [{ categoryId: 'cat-services' }] },
  { key: 'kids', displayNameEn: 'Kids', displayNameNl: 'Kinderen', triggers: [{ categoryId: 'cat-baby' }] },
  { key: 'eating-healthy', displayNameEn: 'Eating healthy', displayNameNl: 'Gezond eten', triggers: [{ categoryId: 'cat-produce' }, { categoryId: 'cat-dairy' }] },
  { key: 'bulk-buy', displayNameEn: 'Bulk buy', displayNameNl: 'Grootverpakking', triggers: [] },
  { key: 'discount-find', displayNameEn: 'Discount find', displayNameNl: 'Koopje gevonden', triggers: [] },
  { key: 'supermarket-ah', displayNameEn: 'Albert Heijn', displayNameNl: 'Albert Heijn', triggers: [{ merchantBrand: 'Albert Heijn' }] },
  { key: 'supermarket-jumbo', displayNameEn: 'Jumbo', displayNameNl: 'Jumbo', triggers: [{ merchantBrand: 'Jumbo' }] },
  { key: 'supermarket-lidl', displayNameEn: 'Lidl', displayNameNl: 'Lidl', triggers: [{ merchantBrand: 'Lidl' }] },
  { key: 'drugstore', displayNameEn: 'Drugstore', displayNameNl: 'Drogisterij', triggers: [{ merchantBrand: 'Kruidvat' }, { merchantBrand: 'Etos' }, { merchantBrand: 'Trekpleister' }] },
  { key: 'variety-store', displayNameEn: 'Variety store', displayNameNl: 'Winkel met gevarieerd aanbod', triggers: [{ merchantBrand: 'HEMA' }, { merchantBrand: 'Action' }] },
];

export const TAG_KEYS: ReadonlySet<string> = new Set(TAG_VOCABULARY.map(tag => tag.key));
