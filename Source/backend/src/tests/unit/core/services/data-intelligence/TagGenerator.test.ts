import { describe, it, expect } from 'vitest';
import { TagGenerator } from '@core/services/data-intelligence/TagGenerator';
import type { TagGenerationInput } from '@core/ports/data-intelligence/ITagGenerator';
import type { NormalizedLine } from '@core/ports/data-intelligence/IProductNormalizer';

const norm = (categoryId: string | null): NormalizedLine => ({
  productId: null,
  categoryId,
  baseUnit: null,
  packQuantity: null,
  sizeSource: null,
  isDepositOrFee: false,
  productProvisional: false,
  confidence: 1,
  lowConfidence: false,
});

const input = (overrides: Partial<TagGenerationInput> = {}): TagGenerationInput => ({
  merchantId: 'm1',
  merchantBrand: 'Jumbo',
  categoryId: 'cat-groceries',
  lines: [{ rawText: 'a', quantity: 1, lineTotal: 6 }, { rawText: 'b', quantity: 1, lineTotal: 4 }],
  normalized: [norm('cat-dairy'), norm('cat-produce')],
  suggestedTags: [],
  ...overrides,
});

describe('TagGenerator', () => {
  it('derives deterministic tags from category shares and the merchant brand', async () => {
    const tags = await new TagGenerator().generate(input({ normalized: [norm('cat-groceries'), norm('cat-groceries')] }));
    expect(tags).toContain('weekly-groceries');
    expect(tags).toContain('supermarket-jumbo');
    expect(tags.length).toBeLessThanOrEqual(3);
  });

  it('merges valid LLM-suggested tags', async () => {
    const tags = await new TagGenerator().generate(input({ merchantBrand: null, normalized: [norm(null), norm(null)], categoryId: null, suggestedTags: ['groceries'] }));
    expect(tags).toEqual(['groceries']);
  });
});
