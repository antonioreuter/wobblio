import type { ParsedLine } from '@core/domain/ingestion';
import type { NormalizedLine } from '@core/ports/data-intelligence/IProductNormalizer';

export interface TagGenerationInput {
  merchantId: string | null;
  merchantBrand: string | null;
  categoryId: string | null;
  lines: ParsedLine[]; // parallel to `normalized`, for per-category spend shares
  normalized: NormalizedLine[];
  suggestedTags: string[]; // LLM suggestions from the §6.3 expansion call
}

// §6.10 search-tag generation, ≤3 tags from the fixed vocabulary.
export interface ITagGenerator {
  generate(input: TagGenerationInput): Promise<string[]>;
}
