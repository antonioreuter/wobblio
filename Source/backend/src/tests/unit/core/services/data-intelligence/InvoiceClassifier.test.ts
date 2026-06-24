import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { InvoiceClassifier } from '@core/services/data-intelligence/InvoiceClassifier';
import type { IMerchantCatalog } from '@core/ports/data-intelligence/IMerchantCatalog';
import type { ClassificationInput } from '@core/ports/data-intelligence/IInvoiceClassifier';
import type { NormalizedLine } from '@core/ports/data-intelligence/IProductNormalizer';
import type { IBedrockConverse } from '@core/ports/ai/IBedrockConverse';

const converseResult = (content: string) => ({ content, inputTokens: 1, outputTokens: 1, modelId: 'm', durationMs: 1 });

const norm = (categoryId: string | null): NormalizedLine => ({
  productId: null,
  categoryId,
  baseUnit: null,
  packQuantity: null,
  normalizedUnitPrice: null,
  isDepositOrFee: false,
  productProvisional: false,
  confidence: 1,
  lowConfidence: false,
});

const input = (overrides: Partial<ClassificationInput> = {}): ClassificationInput => ({
  merchantId: 'm1',
  lines: [{ rawText: 'a', quantity: 1, lineTotal: 8 }, { rawText: 'b', quantity: 1, lineTotal: 2 }],
  normalized: [norm('cat-groceries'), norm('cat-household')],
  ...overrides,
});

describe('InvoiceClassifier', () => {
  let catalog: MockedObject<IMerchantCatalog>;
  let converse: ReturnType<typeof vi.fn>;
  let sut: InvoiceClassifier;

  beforeEach(() => {
    catalog = {
      findExactAlias: vi.fn(),
      findFuzzyAliases: vi.fn(),
      createProvisionalMerchant: vi.fn(),
      writeAlias: vi.fn(),
      getDefaultCategory: vi.fn(),
    };
    converse = vi.fn();
    sut = new InvoiceClassifier(catalog, { converse } as unknown as IBedrockConverse, 'model');
  });

  it('forces Dining Out for a restaurant bill', async () => {
    const result = await sut.classify(input({ documentKindHint: 'RESTAURANT_BILL' }));
    expect(result).toBe('cat-dining-out');
    expect(converse).not.toHaveBeenCalled();
  });

  it('returns the line-item majority when merchant has no prior', async () => {
    catalog.getDefaultCategory.mockResolvedValue(null);
    const result = await sut.classify(input()); // 8 vs 2 => groceries > 50%
    expect(result).toBe('cat-groceries');
    expect(converse).not.toHaveBeenCalled();
  });

  it('returns the merchant prior regardless of line-item vote', async () => {
    catalog.getDefaultCategory.mockResolvedValue('cat-groceries');
    // Even with a clear personal-care majority, the DB prior wins.
    const result = await sut.classify(input({
      normalized: [norm('cat-personal-care'), norm('cat-personal-care')],
    }));
    expect(result).toBe('cat-groceries');
    expect(converse).not.toHaveBeenCalled();
  });

  it('merchant prior overrides even when vote disagrees', async () => {
    catalog.getDefaultCategory.mockResolvedValue('cat-groceries');
    const result = await sut.classify(input({
      lines: [{ rawText: 'a', quantity: 1, lineTotal: 5 }, { rawText: 'b', quantity: 1, lineTotal: 5 }],
      normalized: [norm('cat-personal-care'), norm('cat-household')],
    }));
    expect(result).toBe('cat-groceries');
    expect(converse).not.toHaveBeenCalled();
  });

  it('runs the LLM tiebreak with no prior and maps the result to its macro', async () => {
    catalog.getDefaultCategory.mockResolvedValue(null);
    converse.mockResolvedValue(converseResult('{"category_id":"cat-snacks"}'));
    const result = await sut.classify(input({
      lines: [{ rawText: 'a', quantity: 1, lineTotal: 5 }, { rawText: 'b', quantity: 1, lineTotal: 5 }],
    }));
    expect(result).toBe('cat-groceries'); // cat-snacks rolls up to its macro
  });

  it('normalises a sub-category merchant prior to its macro', async () => {
    catalog.getDefaultCategory.mockResolvedValue('cat-dairy'); // sub-category of cat-groceries
    const result = await sut.classify(input({
      lines: [{ rawText: 'a', quantity: 1, lineTotal: 5 }, { rawText: 'b', quantity: 1, lineTotal: 5 }],
    }));
    expect(result).toBe('cat-groceries');
    expect(converse).not.toHaveBeenCalled();
  });

  it('runs the LLM tiebreak when there is no merchant and lines are uncategorized', async () => {
    converse.mockResolvedValue(converseResult('{"category_id":"cat-other"}'));
    const result = await sut.classify(input({
      merchantId: null,
      lines: [{ rawText: 'a', quantity: 1, lineTotal: 5 }, { rawText: 'b', quantity: 1, lineTotal: 5 }],
      normalized: [norm(null), norm(null)],
    }));
    expect(result).toBe('cat-other');
    expect(catalog.getDefaultCategory).not.toHaveBeenCalled();
  });
});
