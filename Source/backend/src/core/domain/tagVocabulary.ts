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

// Invoice-level tags describe the *kind of invoice* — its macro spending category, the
// occasion, and the venue/merchant type — not individual product attributes. Macro
// triggers fire off the macro-rolled spend shares (see categoryShares / §6.4); brand
// triggers fire off the resolved merchant.
export const TAG_VOCABULARY: TagDefinition[] = [
  // Macro spending category of the invoice.
  { key: 'groceries', displayNameEn: 'Groceries', displayNameNl: 'Boodschappen', triggers: [{ categoryId: 'cat-groceries' }] },
  { key: 'weekly-groceries', displayNameEn: 'Weekly groceries', displayNameNl: 'Weekboodschappen', triggers: [{ categoryId: 'cat-groceries', minSpendShare: 0.6 }] },
  { key: 'household', displayNameEn: 'Household', displayNameNl: 'Huishouden', triggers: [{ categoryId: 'cat-household' }] },
  { key: 'personal-care', displayNameEn: 'Personal care', displayNameNl: 'Persoonlijke verzorging', triggers: [{ categoryId: 'cat-personal-care' }] },
  { key: 'baby-kids', displayNameEn: 'Baby & kids', displayNameNl: 'Baby & kinderen', triggers: [{ categoryId: 'cat-baby' }] },
  { key: 'pet', displayNameEn: 'Pet', displayNameNl: 'Huisdier', triggers: [{ categoryId: 'cat-pet' }] },
  { key: 'dining-out', displayNameEn: 'Dining out', displayNameNl: 'Uit eten', triggers: [{ categoryId: 'cat-dining-out' }] },
  { key: 'takeaway', displayNameEn: 'Takeaway', displayNameNl: 'Afhalen', triggers: [{ categoryId: 'cat-dining-out', minSpendShare: 0.5 }] },
  { key: 'bars-pubs', displayNameEn: 'Bars & pubs', displayNameNl: 'Cafés & kroegen', triggers: [{ categoryId: 'cat-bars-pubs' }] },
  { key: 'accommodation', displayNameEn: 'Accommodation', displayNameNl: 'Accommodatie', triggers: [{ categoryId: 'cat-lodging' }] },
  { key: 'transport', displayNameEn: 'Transport', displayNameNl: 'Vervoer', triggers: [{ categoryId: 'cat-transport' }] },
  { key: 'clothing', displayNameEn: 'Clothing', displayNameNl: 'Kleding', triggers: [{ categoryId: 'cat-clothing' }] },
  { key: 'electronics', displayNameEn: 'Electronics', displayNameNl: 'Elektronica', triggers: [{ categoryId: 'cat-electronics' }] },
  { key: 'health', displayNameEn: 'Health', displayNameNl: 'Gezondheid', triggers: [{ categoryId: 'cat-health' }] },
  { key: 'home-garden', displayNameEn: 'Home & garden', displayNameNl: 'Huis & tuin', triggers: [{ categoryId: 'cat-home-garden' }] },
  { key: 'hardware', displayNameEn: 'Hardware & DIY', displayNameNl: 'Bouwmarkt & klussen', triggers: [{ categoryId: 'cat-hardware' }] },
  { key: 'entertainment', displayNameEn: 'Entertainment', displayNameNl: 'Entertainment', triggers: [{ categoryId: 'cat-entertainment' }] },
  { key: 'services', displayNameEn: 'Services', displayNameNl: 'Diensten', triggers: [{ categoryId: 'cat-services' }] },
  // Venue / merchant type.
  { key: 'supermarket-ah', displayNameEn: 'Albert Heijn', displayNameNl: 'Albert Heijn', triggers: [{ merchantBrand: 'Albert Heijn' }] },
  { key: 'supermarket-jumbo', displayNameEn: 'Jumbo', displayNameNl: 'Jumbo', triggers: [{ merchantBrand: 'Jumbo' }] },
  { key: 'supermarket-lidl', displayNameEn: 'Lidl', displayNameNl: 'Lidl', triggers: [{ merchantBrand: 'Lidl' }] },
  { key: 'drugstore', displayNameEn: 'Drugstore', displayNameNl: 'Drogisterij', triggers: [{ merchantBrand: 'Kruidvat' }, { merchantBrand: 'Etos' }, { merchantBrand: 'Trekpleister' }, { merchantBrand: 'Drogaria São Paulo' }, { merchantBrand: 'Drogasil' }, { merchantBrand: 'Droga Raia' }, { merchantBrand: 'Pague Menos' }, { merchantBrand: 'Drogarias Pacheco' }] },
  { key: 'variety-store', displayNameEn: 'Variety store', displayNameNl: 'Winkel met gevarieerd aanbod', triggers: [{ merchantBrand: 'HEMA' }, { merchantBrand: 'Action' }] },
  { key: 'hotel', displayNameEn: 'Hotel', displayNameNl: 'Hotel', triggers: [{ merchantBrand: 'Booking.com' }, { categoryId: 'cat-lodging' }] },
  { key: 'airbnb', displayNameEn: 'Airbnb', displayNameNl: 'Airbnb', triggers: [{ merchantBrand: 'Airbnb' }] },
  // Brazil — per-brand supermarket tags (national + São Paulo + Bahia + Rio de Janeiro).
  { key: 'supermarket-pao-de-acucar', displayNameEn: 'Pão de Açúcar', displayNameNl: 'Pão de Açúcar', triggers: [{ merchantBrand: 'Pão de Açúcar' }] },
  { key: 'supermarket-carrefour', displayNameEn: 'Carrefour', displayNameNl: 'Carrefour', triggers: [{ merchantBrand: 'Carrefour' }] },
  { key: 'supermarket-extra', displayNameEn: 'Extra', displayNameNl: 'Extra', triggers: [{ merchantBrand: 'Extra' }] },
  { key: 'supermarket-dia', displayNameEn: 'Dia', displayNameNl: 'Dia', triggers: [{ merchantBrand: 'Dia' }] },
  { key: 'supermarket-st-marche', displayNameEn: 'St Marche', displayNameNl: 'St Marche', triggers: [{ merchantBrand: 'St Marche' }] },
  { key: 'supermarket-sonda', displayNameEn: 'Sonda', displayNameNl: 'Sonda', triggers: [{ merchantBrand: 'Sonda' }] },
  { key: 'supermarket-oba', displayNameEn: 'Oba Hortifruti', displayNameNl: 'Oba Hortifruti', triggers: [{ merchantBrand: 'Oba Hortifruti' }] },
  { key: 'supermarket-gbarbosa', displayNameEn: 'GBarbosa', displayNameNl: 'GBarbosa', triggers: [{ merchantBrand: 'GBarbosa' }] },
  { key: 'supermarket-hiperideal', displayNameEn: 'Hiperideal', displayNameNl: 'Hiperideal', triggers: [{ merchantBrand: 'Hiperideal' }] },
  { key: 'supermarket-bompreco', displayNameEn: 'Bompreço', displayNameNl: 'Bompreço', triggers: [{ merchantBrand: 'Bompreço' }] },
  { key: 'supermarket-guanabara', displayNameEn: 'Guanabara', displayNameNl: 'Guanabara', triggers: [{ merchantBrand: 'Guanabara' }] },
  { key: 'supermarket-prezunic', displayNameEn: 'Prezunic', displayNameNl: 'Prezunic', triggers: [{ merchantBrand: 'Prezunic' }] },
  { key: 'supermarket-zona-sul', displayNameEn: 'Zona Sul', displayNameNl: 'Zona Sul', triggers: [{ merchantBrand: 'Zona Sul' }] },
  { key: 'supermarket-mundial', displayNameEn: 'Mundial', displayNameNl: 'Mundial', triggers: [{ merchantBrand: 'Mundial' }] },
  // Brazil — venue-type tags shared across brands.
  { key: 'cash-and-carry', displayNameEn: 'Cash & carry', displayNameNl: 'Groothandel', triggers: [{ merchantBrand: 'Atacadão' }, { merchantBrand: 'Assaí Atacadista' }] },
  { key: 'fashion-retail', displayNameEn: 'Fashion retail', displayNameNl: 'Modewinkel', triggers: [{ merchantBrand: 'Zara' }, { merchantBrand: 'C&A' }, { merchantBrand: 'Renner' }, { merchantBrand: 'Riachuelo' }, { merchantBrand: 'Marisa' }, { merchantBrand: 'Hering' }] },
  { key: 'electronics-store', displayNameEn: 'Electronics store', displayNameNl: 'Elektronicazaak', triggers: [{ merchantBrand: 'Fast Shop' }, { merchantBrand: 'Casas Bahia' }, { merchantBrand: 'Ponto' }, { merchantBrand: 'Magazine Luiza' }, { merchantBrand: 'Kabum' }] },
  { key: 'online-marketplace', displayNameEn: 'Online marketplace', displayNameNl: 'Online marktplaats', triggers: [{ merchantBrand: 'Amazon.com.br' }, { merchantBrand: 'Mercado Livre' }] },
  { key: 'sporting-goods', displayNameEn: 'Sporting goods', displayNameNl: 'Sportzaak', triggers: [{ merchantBrand: 'Centauro' }, { merchantBrand: 'Decathlon' }] },
  { key: 'department-store', displayNameEn: 'Department store', displayNameNl: 'Warenhuis', triggers: [{ merchantBrand: 'Americanas' }, { merchantBrand: 'Havan' }] },
];

export const TAG_KEYS: ReadonlySet<string> = new Set(TAG_VOCABULARY.map(tag => tag.key));

const LABEL_BY_KEY = new Map<string, string>(TAG_VOCABULARY.map(tag => [tag.key, tag.displayNameEn]));

// Resolve a stored tag key to its display label for the UI. Unknown keys (e.g. tags
// stored before a vocabulary change) fall back to the raw key.
export function tagLabelFor(key: string): string {
  return LABEL_BY_KEY.get(key) ?? key;
}
