import type { NormalizedLine } from '@core/ports/IProductNormalizer';

export interface TagGenerationInput {
  merchantId: string | null;
  categoryId: string | null;
  normalized: NormalizedLine[];
}

// §6.10 search-tag generation, ≤3 tags from the fixed vocabulary. Real impl lands in Epic 08.
export interface ITagGenerator {
  generate(input: TagGenerationInput): Promise<string[]>;
}
