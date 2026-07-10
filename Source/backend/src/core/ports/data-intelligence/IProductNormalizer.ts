import type { ParsedLine } from '@core/domain/ingestion';

// Enrichment overlay for one parsed line; returned parallel to the input lines.
export interface NormalizedLine {
  productId: string | null;
  categoryId: string | null;
  baseUnit: 'KG' | 'L' | 'PIECE' | null;
  packQuantity: number | null;
  normalizedUnitPrice: number | null;
  isDepositOrFee: boolean;
  productProvisional: boolean; // true when a PROVISIONAL product was auto-created
  confidence: number; // 0..1
  lowConfidence: boolean; // embedding 0.85–0.92 band
}

export interface NormalizationResult {
  lines: NormalizedLine[];
  suggestedTags: string[]; // LLM tag suggestions piggybacked on the §6.3 expansion call
}

// Venue context for a receipt's merchant, fed into per-line expansion so served food/drink
// is routed to dining-out/bars leaves rather than grocery leaves (fixes/08). Both fields are
// optional signals: brand lets the model recognise a known chain; categoryPrior is the
// merchant's macro default_category_id (a deterministic venue anchor from seeds/classifier).
export interface MerchantExpansionContext {
  brandName: string | null;
  categoryPrior: string | null;
}

// §6.3 product normalization + categorization. countryCode scopes the catalog: a
// product belongs to the country its invoice was located in, and matches only within
// that country (so the same item in two countries is two distinct catalog rows).
export interface IProductNormalizer {
  normalize(
    merchantId: string | null,
    lines: ParsedLine[],
    countryCode: string,
    merchant?: MerchantExpansionContext,
  ): Promise<NormalizationResult>;
}
