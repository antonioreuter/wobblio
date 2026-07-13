import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InvoiceClassifier } from '@core/services/data-intelligence/InvoiceClassifier';
import type { ClassificationInput } from '@core/ports/data-intelligence/IInvoiceClassifier';
import type { NormalizedLine } from '@core/ports/data-intelligence/IProductNormalizer';
import type { IBedrockConverse } from '@core/ports/ai/IBedrockConverse';

const converseResult = (content: string) => ({ content, inputTokens: 1, outputTokens: 1, modelId: 'm', durationMs: 1 });

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

const input = (overrides: Partial<ClassificationInput> = {}): ClassificationInput => ({
  merchantId: 'm1',
  merchantPrior: null,
  lines: [{ rawText: 'a', quantity: 1, lineTotal: 8 }, { rawText: 'b', quantity: 1, lineTotal: 2 }],
  normalized: [norm('cat-groceries'), norm('cat-household')],
  ...overrides,
});

describe('InvoiceClassifier', () => {
  let converse: ReturnType<typeof vi.fn>;
  let sut: InvoiceClassifier;

  beforeEach(() => {
    converse = vi.fn();
    // The merchant prior is resolved upstream and passed in ClassificationInput — the
    // classifier no longer reads it from the catalog, so no catalog dependency.
    sut = new InvoiceClassifier({ converse } as unknown as IBedrockConverse, 'model');
  });

  it('forces Dining Out for a restaurant bill', async () => {
    const result = await sut.classify(input({ documentKindHint: 'RESTAURANT_BILL' }));
    expect(result).toBe('cat-dining-out');
    expect(converse).not.toHaveBeenCalled();
  });

  it('returns the line-item majority when merchant has no prior', async () => {
    const result = await sut.classify(input({ merchantPrior: null })); // 8 vs 2 => groceries > 50%
    expect(result).toBe('cat-groceries');
    expect(converse).not.toHaveBeenCalled();
  });

  it('returns the merchant prior regardless of line-item vote', async () => {
    // Even with a clear personal-care majority, the DB prior wins.
    const result = await sut.classify(input({
      merchantPrior: 'cat-groceries',
      normalized: [norm('cat-personal-care'), norm('cat-personal-care')],
    }));
    expect(result).toBe('cat-groceries');
    expect(converse).not.toHaveBeenCalled();
  });

  it('merchant prior overrides even when vote disagrees', async () => {
    const result = await sut.classify(input({
      merchantPrior: 'cat-groceries',
      lines: [{ rawText: 'a', quantity: 1, lineTotal: 5 }, { rawText: 'b', quantity: 1, lineTotal: 5 }],
      normalized: [norm('cat-personal-care'), norm('cat-household')],
    }));
    expect(result).toBe('cat-groceries');
    expect(converse).not.toHaveBeenCalled();
  });

  it('runs the LLM tiebreak with no prior and maps the result to its macro', async () => {
    converse.mockResolvedValue(converseResult('{"category_id":"cat-snacks"}'));
    const result = await sut.classify(input({
      merchantPrior: null,
      lines: [{ rawText: 'a', quantity: 1, lineTotal: 5 }, { rawText: 'b', quantity: 1, lineTotal: 5 }],
    }));
    expect(result).toBe('cat-groceries'); // cat-snacks rolls up to its macro
  });

  it('normalises a sub-category merchant prior to its macro', async () => {
    const result = await sut.classify(input({
      merchantPrior: 'cat-dairy', // sub-category of cat-groceries
      lines: [{ rawText: 'a', quantity: 1, lineTotal: 5 }, { rawText: 'b', quantity: 1, lineTotal: 5 }],
    }));
    expect(result).toBe('cat-groceries');
    expect(converse).not.toHaveBeenCalled();
  });

  it('runs the LLM tiebreak when there is no merchant and lines are uncategorized', async () => {
    converse.mockResolvedValue(converseResult('{"category_id":"cat-other"}'));
    const result = await sut.classify(input({
      merchantId: null,
      merchantPrior: null,
      lines: [{ rawText: 'a', quantity: 1, lineTotal: 5 }, { rawText: 'b', quantity: 1, lineTotal: 5 }],
      normalized: [norm(null), norm(null)],
    }));
    expect(result).toBe('cat-other');
  });
});
