import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { IngestionService } from '@core/services/IngestionService';
import type { VisionParseService } from '@core/services/VisionParseService';
import type { ITenantContext } from '@core/ports/ITenantContext';
import type { IIngestionLedger } from '@core/ports/IIngestionLedger';
import type { IS3FileStorage } from '@core/ports/IS3FileStorage';
import type { IMerchantResolver } from '@core/ports/IMerchantResolver';
import type { IProductNormalizer, NormalizedLine } from '@core/ports/IProductNormalizer';
import type { IInvoiceClassifier } from '@core/ports/IInvoiceClassifier';
import type { ITagGenerator } from '@core/ports/ITagGenerator';
import type { IInvoiceRepository } from '@core/ports/IInvoiceRepository';
import type { ParsedReceipt } from '@core/domain/ingestion';

const MESSAGE = { invoiceId: 'inv-1', tenantId: 'tenant-1', s3Key: 'receipts/tenant-1/abc.jpg' };

// total 3.0 = 4.0 + (-1.0); line 2 is a discount with no unit_price.
const receipt = (parseConfidence = 0.9): ParsedReceipt => ({
  merchantRaw: 'Albert Heijn',
  transactionDate: '2026-06-10',
  currency: 'EUR',
  total: 3.0,
  lines: [
    { rawText: 'Melk', quantity: 1, lineTotal: 4.0, unitPrice: 2.0 },
    { rawText: 'Korting', quantity: 1, lineTotal: -1.0 },
  ],
  parseConfidence,
});

const normalizedLine = (lowConfidence = false): NormalizedLine => ({
  productId: null,
  categoryId: null,
  baseUnit: null,
  packQuantity: null,
  normalizedUnitPrice: null,
  isDepositOrFee: false,
  confidence: 0,
  lowConfidence,
});

describe('IngestionService', () => {
  let tenantContext: MockedObject<ITenantContext>;
  let ledger: MockedObject<IIngestionLedger>;
  let storage: MockedObject<IS3FileStorage>;
  let visionParser: { parse: ReturnType<typeof vi.fn> };
  let merchantResolver: MockedObject<IMerchantResolver>;
  let productNormalizer: MockedObject<IProductNormalizer>;
  let classifier: MockedObject<IInvoiceClassifier>;
  let tagGenerator: MockedObject<ITagGenerator>;
  let invoiceRepo: MockedObject<IInvoiceRepository>;
  let sut: IngestionService;

  beforeEach(() => {
    tenantContext = { setTenantId: vi.fn() };
    ledger = { claim: vi.fn(), setStatus: vi.fn() };
    storage = { presignPut: vi.fn(), presignGet: vi.fn(), headExists: vi.fn(), getObjectBytes: vi.fn() };
    visionParser = { parse: vi.fn() };
    merchantResolver = { resolve: vi.fn() };
    productNormalizer = { normalize: vi.fn() };
    classifier = { classify: vi.fn() };
    tagGenerator = { generate: vi.fn() };
    invoiceRepo = {
      createPending: vi.fn(),
      getById: vi.fn(),
      findSameTenantByHash: vi.fn(),
      findFuzzyDuplicate: vi.fn(),
      persistParsed: vi.fn(),
      updateStatus: vi.fn(),
      listForTenant: vi.fn(),
      getDetail: vi.fn(),
    };
    sut = new IngestionService(
      tenantContext, ledger, storage,
      visionParser as unknown as VisionParseService,
      merchantResolver, productNormalizer, classifier, tagGenerator, invoiceRepo,
    );
  });

  const arrangeHappyPath = (parseConfidence = 0.9, lowConfidence = false) => {
    ledger.claim.mockResolvedValue(true);
    storage.getObjectBytes.mockResolvedValue(new Uint8Array([1]));
    visionParser.parse.mockResolvedValue(receipt(parseConfidence));
    merchantResolver.resolve.mockResolvedValue({ merchantId: 'm1', branchId: 'b1', confidence: 0.9 });
    productNormalizer.normalize.mockResolvedValue([normalizedLine(lowConfidence), normalizedLine()]);
    classifier.classify.mockResolvedValue('groceries');
    tagGenerator.generate.mockResolvedValue(['weekly-groceries']);
    invoiceRepo.findFuzzyDuplicate.mockResolvedValue(false);
  };

  it('short-circuits a duplicate SQS delivery after setting tenant context', async () => {
    ledger.claim.mockResolvedValue(false);

    const outcome = await sut.process(MESSAGE);

    expect(outcome).toEqual({ handled: false });
    expect(tenantContext.setTenantId).toHaveBeenCalledWith('tenant-1');
    expect(storage.getObjectBytes).not.toHaveBeenCalled();
  });

  it('persists a PARSED invoice and maps lines (discount + unit price) on the happy path', async () => {
    arrangeHappyPath();

    const outcome = await sut.process(MESSAGE);

    expect(outcome).toEqual({ handled: true, status: 'PARSED' });
    expect(invoiceRepo.findFuzzyDuplicate).toHaveBeenCalledWith('inv-1', {
      merchantId: 'm1', transactionDate: '2026-06-10', total: 3.0, lineCount: 2,
    });
    const persisted = invoiceRepo.persistParsed.mock.calls[0][0];
    expect(persisted.status).toBe('PARSED');
    expect(persisted.searchTags).toEqual(['weekly-groceries']);
    expect(persisted.lines[0]).toMatchObject({ unitPrice: 2.0, isDiscount: false });
    expect(persisted.lines[1]).toMatchObject({ unitPrice: null, isDiscount: true });
    expect(ledger.setStatus).toHaveBeenCalledWith(MESSAGE.s3Key, 'DONE');
  });

  it('flags NEEDS_REVIEW when vision confidence is below threshold', async () => {
    arrangeHappyPath(0.5);

    const outcome = await sut.process(MESSAGE);

    expect(outcome.status).toBe('NEEDS_REVIEW');
  });

  it('flags NEEDS_REVIEW when a normalized line is low confidence', async () => {
    arrangeHappyPath(0.9, true);

    const outcome = await sut.process(MESSAGE);

    expect(outcome.status).toBe('NEEDS_REVIEW');
  });

  it('flags SUSPECTED_DUPLICATE when a fuzzy fingerprint matches', async () => {
    arrangeHappyPath();
    invoiceRepo.findFuzzyDuplicate.mockResolvedValue(true);

    const outcome = await sut.process(MESSAGE);

    expect(outcome.status).toBe('SUSPECTED_DUPLICATE');
  });
});
