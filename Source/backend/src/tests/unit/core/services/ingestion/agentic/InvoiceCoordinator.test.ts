import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InvoiceCoordinator } from '@core/services/ingestion/agentic/InvoiceCoordinator';
import type { MerchantResolverTool } from '@core/services/ingestion/agentic/tools/MerchantResolverTool';
import type { ProductNormalizerTool } from '@core/services/ingestion/agentic/tools/ProductNormalizerTool';
import type { InvoiceClassifierTool } from '@core/services/ingestion/agentic/tools/InvoiceClassifierTool';
import type { SearchTagGeneratorTool } from '@core/services/ingestion/agentic/tools/SearchTagGeneratorTool';
import type { IAgenticStageInstrumentation } from '@core/ports/observability/IAgenticStageInstrumentation';
import type { ParsedReceipt } from '@core/domain/ingestion';
import type { ResolvedIngestionLocation } from '@core/domain/region';
import type { NormalizedLine } from '@core/ports/data-intelligence/IProductNormalizer';

const INVOICE_ID = 'inv-1';

const RECEIPT: ParsedReceipt = {
  merchantRaw: 'Albert Heijn',
  transactionDate: '2026-06-10',
  currency: 'EUR',
  total: 3.0,
  documentKindHint: 'grocery',
  lines: [{ rawText: 'Melk', quantity: 1, lineTotal: 3.0, unitPrice: 3.0 }],
  parseConfidence: 0.9,
};

const LOCATION: ResolvedIngestionLocation = {
  countryCode: 'NL',
  regionCode: 'NL-NB',
  status: 'RESOLVED',
  source: 'RECEIPT',
};

const NORMALIZED: NormalizedLine[] = [{
  productId: 'p1', categoryId: 'groceries', baseUnit: 'L', packQuantity: 1,
  normalizedUnitPrice: 3.0, isDepositOrFee: false, productProvisional: false, confidence: 0.95, lowConfidence: false,
}];

describe('InvoiceCoordinator', () => {
  let merchantTool: { run: ReturnType<typeof vi.fn> };
  let productTool: { run: ReturnType<typeof vi.fn> };
  let classifierTool: { run: ReturnType<typeof vi.fn> };
  let tagTool: { run: ReturnType<typeof vi.fn> };
  let instrumentation: IAgenticStageInstrumentation;
  let coordinator: InvoiceCoordinator;
  const order: string[] = [];

  beforeEach(() => {
    order.length = 0;
    merchantTool = { run: vi.fn(async () => { order.push('merchant'); return { merchantId: 'm1', brandName: 'AH', defaultCategoryId: null, provisional: false, confidence: 0.9 }; }) };
    productTool = { run: vi.fn(async () => { order.push('product'); return { lines: NORMALIZED, suggestedTags: ['dairy'] }; }) };
    classifierTool = { run: vi.fn(async () => { order.push('classify'); return 'groceries'; }) };
    tagTool = { run: vi.fn(async () => { order.push('tag'); return ['weekly-groceries']; }) };
    instrumentation = { recordStageOutcome: vi.fn() };
    coordinator = new InvoiceCoordinator(
      merchantTool as unknown as MerchantResolverTool,
      productTool as unknown as ProductNormalizerTool,
      classifierTool as unknown as InvoiceClassifierTool,
      tagTool as unknown as SearchTagGeneratorTool,
      instrumentation,
    );
  });

  it('dispatches the tools in the forced order merchant → product → classify → tag', async () => {
    await coordinator.extract(RECEIPT, LOCATION, INVOICE_ID);
    expect(order).toEqual(['merchant', 'product', 'classify', 'tag']);
  });

  it('threads the resolved country and canonical ids between tools', async () => {
    await coordinator.extract(RECEIPT, LOCATION, INVOICE_ID);
    expect(merchantTool.run).toHaveBeenCalledWith('Albert Heijn', 'NL');
    expect(productTool.run).toHaveBeenCalledWith('m1', RECEIPT.lines, 'NL', { brandName: 'AH', categoryPrior: null, documentKindHint: 'grocery' });
    expect(classifierTool.run).toHaveBeenCalledWith({
      merchantId: 'm1', merchantPrior: null, documentKindHint: 'grocery', lines: RECEIPT.lines, normalized: NORMALIZED,
    });
    expect(tagTool.run).toHaveBeenCalledWith({
      merchantId: 'm1', merchantBrand: 'AH', categoryId: 'groceries', lines: RECEIPT.lines, normalized: NORMALIZED, suggestedTags: ['dairy'],
    });
  });

  it('assembles the extraction result the finalizer consumes', async () => {
    const result = await coordinator.extract(RECEIPT, LOCATION, INVOICE_ID);
    expect(result).toEqual({
      receipt: RECEIPT,
      location: LOCATION,
      merchant: { merchantId: 'm1', brandName: 'AH', defaultCategoryId: null, provisional: false, confidence: 0.9 },
      normalized: NORMALIZED,
      categoryId: 'groceries',
      tags: ['weekly-groceries'],
    });
  });

  it('reports every stage outcome to the instrumentation port on the happy path', async () => {
    await coordinator.extract(RECEIPT, LOCATION, INVOICE_ID);
    const calls = (instrumentation.recordStageOutcome as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.map((c) => c[0])).toEqual([
      'MERCHANT_RESOLUTION', 'PRODUCT_NORMALIZATION', 'INVOICE_CLASSIFICATION', 'TAG_GENERATION',
    ]);
    for (const call of calls) {
      expect(call[1]).toBe(INVOICE_ID);
      expect(typeof call[2]).toBe('number');
      expect(call[3]).toBeUndefined(); // no error on success
    }
  });

  it('reports the failing stage and rethrows the original error unchanged, skipping downstream tools', async () => {
    const boom = Object.assign(new Error('merchant catalog unreachable'), { code: '08006' });
    merchantTool.run.mockRejectedValueOnce(boom);

    await expect(coordinator.extract(RECEIPT, LOCATION, INVOICE_ID)).rejects.toBe(boom);

    expect(instrumentation.recordStageOutcome).toHaveBeenCalledTimes(1);
    expect(instrumentation.recordStageOutcome).toHaveBeenCalledWith(
      'MERCHANT_RESOLUTION', INVOICE_ID, expect.any(Number), 'merchant catalog unreachable',
    );
    expect(productTool.run).not.toHaveBeenCalled();
    expect(classifierTool.run).not.toHaveBeenCalled();
    expect(tagTool.run).not.toHaveBeenCalled();
  });

  it('coerces a non-Error thrown value to a string message for instrumentation', async () => {
    productTool.run.mockRejectedValueOnce('rate limited');

    await expect(coordinator.extract(RECEIPT, LOCATION, INVOICE_ID)).rejects.toBe('rate limited');

    expect(instrumentation.recordStageOutcome).toHaveBeenLastCalledWith(
      'PRODUCT_NORMALIZATION', INVOICE_ID, expect.any(Number), 'rate limited',
    );
  });

  it('still returns the tool result when the instrumentation port itself throws on success', async () => {
    (instrumentation.recordStageOutcome as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('logger serialization failed');
    });

    const result = await coordinator.extract(RECEIPT, LOCATION, INVOICE_ID);
    expect(result.merchant).toEqual({ merchantId: 'm1', brandName: 'AH', defaultCategoryId: null, provisional: false, confidence: 0.9 });
  });

  it('still rethrows the original tool error when the instrumentation port itself throws on failure', async () => {
    const boom = new Error('merchant catalog unreachable');
    merchantTool.run.mockRejectedValueOnce(boom);
    (instrumentation.recordStageOutcome as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('logger serialization failed');
    });

    await expect(coordinator.extract(RECEIPT, LOCATION, INVOICE_ID)).rejects.toBe(boom);
  });
});
