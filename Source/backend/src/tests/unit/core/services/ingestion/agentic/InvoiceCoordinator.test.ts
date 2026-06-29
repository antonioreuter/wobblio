import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InvoiceCoordinator } from '@core/services/ingestion/agentic/InvoiceCoordinator';
import type { MerchantResolverTool } from '@core/services/ingestion/agentic/tools/MerchantResolverTool';
import type { ProductNormalizerTool } from '@core/services/ingestion/agentic/tools/ProductNormalizerTool';
import type { InvoiceClassifierTool } from '@core/services/ingestion/agentic/tools/InvoiceClassifierTool';
import type { SearchTagGeneratorTool } from '@core/services/ingestion/agentic/tools/SearchTagGeneratorTool';
import type { ParsedReceipt } from '@core/domain/ingestion';
import type { ResolvedIngestionLocation } from '@core/domain/region';
import type { NormalizedLine } from '@core/ports/data-intelligence/IProductNormalizer';

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
  let coordinator: InvoiceCoordinator;
  const order: string[] = [];

  beforeEach(() => {
    order.length = 0;
    merchantTool = { run: vi.fn(async () => { order.push('merchant'); return { merchantId: 'm1', brandName: 'AH', provisional: false, confidence: 0.9 }; }) };
    productTool = { run: vi.fn(async () => { order.push('product'); return { lines: NORMALIZED, suggestedTags: ['dairy'] }; }) };
    classifierTool = { run: vi.fn(async () => { order.push('classify'); return 'groceries'; }) };
    tagTool = { run: vi.fn(async () => { order.push('tag'); return ['weekly-groceries']; }) };
    coordinator = new InvoiceCoordinator(
      merchantTool as unknown as MerchantResolverTool,
      productTool as unknown as ProductNormalizerTool,
      classifierTool as unknown as InvoiceClassifierTool,
      tagTool as unknown as SearchTagGeneratorTool,
    );
  });

  it('dispatches the tools in the forced order merchant → product → classify → tag', async () => {
    await coordinator.extract(RECEIPT, LOCATION);
    expect(order).toEqual(['merchant', 'product', 'classify', 'tag']);
  });

  it('threads the resolved country and canonical ids between tools', async () => {
    await coordinator.extract(RECEIPT, LOCATION);
    expect(merchantTool.run).toHaveBeenCalledWith('Albert Heijn', 'NL');
    expect(productTool.run).toHaveBeenCalledWith('m1', RECEIPT.lines, 'NL');
    expect(classifierTool.run).toHaveBeenCalledWith({
      merchantId: 'm1', documentKindHint: 'grocery', lines: RECEIPT.lines, normalized: NORMALIZED,
    });
    expect(tagTool.run).toHaveBeenCalledWith({
      merchantId: 'm1', merchantBrand: 'AH', categoryId: 'groceries', lines: RECEIPT.lines, normalized: NORMALIZED, suggestedTags: ['dairy'],
    });
  });

  it('assembles the extraction result the finalizer consumes', async () => {
    const result = await coordinator.extract(RECEIPT, LOCATION);
    expect(result).toEqual({
      receipt: RECEIPT,
      location: LOCATION,
      merchant: { merchantId: 'm1', brandName: 'AH', provisional: false, confidence: 0.9 },
      normalized: NORMALIZED,
      categoryId: 'groceries',
      tags: ['weekly-groceries'],
    });
  });
});
