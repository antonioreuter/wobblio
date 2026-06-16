import type { ParsedLine } from '@core/domain/ingestion';

// Enrichment overlay for one parsed line; returned parallel to the input lines.
export interface NormalizedLine {
  productId: string | null;
  categoryId: string | null;
  baseUnit: 'KG' | 'L' | 'PIECE' | null;
  packQuantity: number | null;
  normalizedUnitPrice: number | null;
  isDepositOrFee: boolean;
  confidence: number; // 0..1
  lowConfidence: boolean; // embedding 0.85–0.92 band
}

// §6.3 product normalization + categorization. Real impl lands in Epic 08.
export interface IProductNormalizer {
  normalize(merchantId: string | null, lines: ParsedLine[]): Promise<NormalizedLine[]>;
}
