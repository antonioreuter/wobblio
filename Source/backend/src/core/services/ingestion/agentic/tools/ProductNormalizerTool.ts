import type { IProductNormalizer, NormalizationResult, MerchantExpansionContext } from '../../../../ports/data-intelligence/IProductNormalizer';
import type { ParsedLine } from '../../../../domain/ingestion';

// Tool 3 (parent §3): batch product normalization + categorization (abbreviation expansion,
// pgvector match, unit-price normalization). Thin wrapper over ProductNormalizer.
export class ProductNormalizerTool {
  constructor(private readonly normalizer: IProductNormalizer) {}

  run(merchantId: string | null, lines: ParsedLine[], countryCode: string, merchant?: MerchantExpansionContext): Promise<NormalizationResult> {
    return this.normalizer.normalize(merchantId, lines, countryCode, merchant);
  }
}
