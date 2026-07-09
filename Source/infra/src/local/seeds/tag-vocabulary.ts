export interface Tag {
  tag_key: string;
  display_name_nl: string;
  display_name_en: string;
  trigger_map: Array<{ category_id?: string; merchant_brand?: string; min_spend_share?: number }>;
}

// Mirrors the in-process backend TAG_VOCABULARY (Source/backend/src/core/domain/tagVocabulary.ts).
// Invoice-level tags describe the *kind of invoice* — its macro spending category and the
// venue/merchant type — not individual product attributes. Keep in sync with the backend.
const tagVocabulary: Tag[] = [
  // Macro spending category of the invoice.
  { tag_key: 'groceries', display_name_nl: 'Boodschappen', display_name_en: 'Groceries', trigger_map: [{ category_id: 'cat-groceries' }] },
  { tag_key: 'weekly-groceries', display_name_nl: 'Weekboodschappen', display_name_en: 'Weekly groceries', trigger_map: [{ category_id: 'cat-groceries', min_spend_share: 0.6 }] },
  { tag_key: 'household', display_name_nl: 'Huishouden', display_name_en: 'Household', trigger_map: [{ category_id: 'cat-household' }] },
  { tag_key: 'personal-care', display_name_nl: 'Persoonlijke verzorging', display_name_en: 'Personal care', trigger_map: [{ category_id: 'cat-personal-care' }] },
  { tag_key: 'baby-kids', display_name_nl: 'Baby & kinderen', display_name_en: 'Baby & kids', trigger_map: [{ category_id: 'cat-baby' }] },
  { tag_key: 'pet', display_name_nl: 'Huisdier', display_name_en: 'Pet', trigger_map: [{ category_id: 'cat-pet' }] },
  { tag_key: 'dining-out', display_name_nl: 'Uit eten', display_name_en: 'Dining out', trigger_map: [{ category_id: 'cat-dining-out' }] },
  { tag_key: 'takeaway', display_name_nl: 'Afhalen', display_name_en: 'Takeaway', trigger_map: [{ category_id: 'cat-dining-out', min_spend_share: 0.5 }] },
  { tag_key: 'bars-pubs', display_name_nl: 'Cafés & kroegen', display_name_en: 'Bars & pubs', trigger_map: [{ category_id: 'cat-bars-pubs' }] },
  { tag_key: 'accommodation', display_name_nl: 'Accommodatie', display_name_en: 'Accommodation', trigger_map: [{ category_id: 'cat-lodging' }] },
  { tag_key: 'transport', display_name_nl: 'Vervoer', display_name_en: 'Transport', trigger_map: [{ category_id: 'cat-transport' }] },
  { tag_key: 'clothing', display_name_nl: 'Kleding', display_name_en: 'Clothing', trigger_map: [{ category_id: 'cat-clothing' }] },
  { tag_key: 'electronics', display_name_nl: 'Elektronica', display_name_en: 'Electronics', trigger_map: [{ category_id: 'cat-electronics' }] },
  { tag_key: 'health', display_name_nl: 'Gezondheid', display_name_en: 'Health', trigger_map: [{ category_id: 'cat-health' }] },
  { tag_key: 'home-garden', display_name_nl: 'Huis & tuin', display_name_en: 'Home & garden', trigger_map: [{ category_id: 'cat-home-garden' }] },
  { tag_key: 'hardware', display_name_nl: 'Bouwmarkt & klussen', display_name_en: 'Hardware & DIY', trigger_map: [{ category_id: 'cat-hardware' }] },
  { tag_key: 'entertainment', display_name_nl: 'Entertainment', display_name_en: 'Entertainment', trigger_map: [{ category_id: 'cat-entertainment' }] },
  { tag_key: 'services', display_name_nl: 'Diensten', display_name_en: 'Services', trigger_map: [{ category_id: 'cat-services' }] },
  // Venue / merchant type.
  { tag_key: 'supermarket-ah', display_name_nl: 'Albert Heijn', display_name_en: 'Albert Heijn', trigger_map: [{ merchant_brand: 'Albert Heijn' }] },
  { tag_key: 'supermarket-jumbo', display_name_nl: 'Jumbo', display_name_en: 'Jumbo', trigger_map: [{ merchant_brand: 'Jumbo' }] },
  { tag_key: 'supermarket-lidl', display_name_nl: 'Lidl', display_name_en: 'Lidl', trigger_map: [{ merchant_brand: 'Lidl' }] },
  { tag_key: 'drugstore', display_name_nl: 'Drogisterij', display_name_en: 'Drugstore', trigger_map: [{ merchant_brand: 'Kruidvat' }, { merchant_brand: 'Etos' }, { merchant_brand: 'Trekpleister' }, { merchant_brand: 'Drogaria São Paulo' }, { merchant_brand: 'Drogasil' }, { merchant_brand: 'Droga Raia' }, { merchant_brand: 'Pague Menos' }, { merchant_brand: 'Drogarias Pacheco' }] },
  { tag_key: 'variety-store', display_name_nl: 'Winkel met gevarieerd aanbod', display_name_en: 'Variety store', trigger_map: [{ merchant_brand: 'HEMA' }, { merchant_brand: 'Action' }] },
  { tag_key: 'hotel', display_name_nl: 'Hotel', display_name_en: 'Hotel', trigger_map: [{ merchant_brand: 'Booking.com' }, { category_id: 'cat-lodging' }] },
  { tag_key: 'airbnb', display_name_nl: 'Airbnb', display_name_en: 'Airbnb', trigger_map: [{ merchant_brand: 'Airbnb' }] },
  // Brazil — per-brand supermarket tags (national + São Paulo + Bahia + Rio de Janeiro).
  { tag_key: 'supermarket-pao-de-acucar', display_name_nl: 'Pão de Açúcar', display_name_en: 'Pão de Açúcar', trigger_map: [{ merchant_brand: 'Pão de Açúcar' }] },
  { tag_key: 'supermarket-carrefour', display_name_nl: 'Carrefour', display_name_en: 'Carrefour', trigger_map: [{ merchant_brand: 'Carrefour' }] },
  { tag_key: 'supermarket-extra', display_name_nl: 'Extra', display_name_en: 'Extra', trigger_map: [{ merchant_brand: 'Extra' }] },
  { tag_key: 'supermarket-dia', display_name_nl: 'Dia', display_name_en: 'Dia', trigger_map: [{ merchant_brand: 'Dia' }] },
  { tag_key: 'supermarket-st-marche', display_name_nl: 'St Marche', display_name_en: 'St Marche', trigger_map: [{ merchant_brand: 'St Marche' }] },
  { tag_key: 'supermarket-sonda', display_name_nl: 'Sonda', display_name_en: 'Sonda', trigger_map: [{ merchant_brand: 'Sonda' }] },
  { tag_key: 'supermarket-oba', display_name_nl: 'Oba Hortifruti', display_name_en: 'Oba Hortifruti', trigger_map: [{ merchant_brand: 'Oba Hortifruti' }] },
  { tag_key: 'supermarket-gbarbosa', display_name_nl: 'GBarbosa', display_name_en: 'GBarbosa', trigger_map: [{ merchant_brand: 'GBarbosa' }] },
  { tag_key: 'supermarket-hiperideal', display_name_nl: 'Hiperideal', display_name_en: 'Hiperideal', trigger_map: [{ merchant_brand: 'Hiperideal' }] },
  { tag_key: 'supermarket-bompreco', display_name_nl: 'Bompreço', display_name_en: 'Bompreço', trigger_map: [{ merchant_brand: 'Bompreço' }] },
  { tag_key: 'supermarket-guanabara', display_name_nl: 'Guanabara', display_name_en: 'Guanabara', trigger_map: [{ merchant_brand: 'Guanabara' }] },
  { tag_key: 'supermarket-prezunic', display_name_nl: 'Prezunic', display_name_en: 'Prezunic', trigger_map: [{ merchant_brand: 'Prezunic' }] },
  { tag_key: 'supermarket-zona-sul', display_name_nl: 'Zona Sul', display_name_en: 'Zona Sul', trigger_map: [{ merchant_brand: 'Zona Sul' }] },
  { tag_key: 'supermarket-mundial', display_name_nl: 'Mundial', display_name_en: 'Mundial', trigger_map: [{ merchant_brand: 'Mundial' }] },
  // Brazil — venue-type tags shared across brands.
  { tag_key: 'cash-and-carry', display_name_nl: 'Groothandel', display_name_en: 'Cash & carry', trigger_map: [{ merchant_brand: 'Atacadão' }, { merchant_brand: 'Assaí Atacadista' }] },
  { tag_key: 'fashion-retail', display_name_nl: 'Modewinkel', display_name_en: 'Fashion retail', trigger_map: [{ merchant_brand: 'Zara' }, { merchant_brand: 'C&A' }, { merchant_brand: 'Renner' }, { merchant_brand: 'Riachuelo' }, { merchant_brand: 'Marisa' }, { merchant_brand: 'Hering' }] },
  { tag_key: 'electronics-store', display_name_nl: 'Elektronicazaak', display_name_en: 'Electronics store', trigger_map: [{ merchant_brand: 'Fast Shop' }, { merchant_brand: 'Casas Bahia' }, { merchant_brand: 'Ponto' }, { merchant_brand: 'Magazine Luiza' }, { merchant_brand: 'Kabum' }] },
  { tag_key: 'online-marketplace', display_name_nl: 'Online marktplaats', display_name_en: 'Online marketplace', trigger_map: [{ merchant_brand: 'Amazon.com.br' }, { merchant_brand: 'Mercado Livre' }] },
  { tag_key: 'sporting-goods', display_name_nl: 'Sportzaak', display_name_en: 'Sporting goods', trigger_map: [{ merchant_brand: 'Centauro' }, { merchant_brand: 'Decathlon' }] },
  { tag_key: 'department-store', display_name_nl: 'Warenhuis', display_name_en: 'Department store', trigger_map: [{ merchant_brand: 'Americanas' }, { merchant_brand: 'Havan' }] },
];

export default tagVocabulary;
