import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { IngestionService } from '@core/services/ingestion/IngestionService';
import type { VisionParseService } from '@core/services/ingestion/VisionParseService';
import type { ITenantContext } from '@core/ports/identity/ITenantContext';
import type { IIngestionLedger } from '@core/ports/ingestion/IIngestionLedger';
import type { IS3FileStorage } from '@core/ports/ingestion/IS3FileStorage';
import type { IMerchantResolver } from '@core/ports/data-intelligence/IMerchantResolver';
import type { IProductNormalizer, NormalizedLine } from '@core/ports/data-intelligence/IProductNormalizer';
import type { IInvoiceClassifier } from '@core/ports/data-intelligence/IInvoiceClassifier';
import type { ITagGenerator } from '@core/ports/data-intelligence/ITagGenerator';
import type { IInvoiceRepository } from '@core/ports/ingestion/IInvoiceRepository';
import type { IPriceObservationStore } from '@core/ports/data-intelligence/IPriceObservationStore';
import type { IContributorContextRepository } from '@core/ports/data-intelligence/IContributorContextRepository';
import type { IRegionReference } from '@core/ports/data-intelligence/IRegionReference';
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
  productProvisional: false,
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
  let priceObservationStore: MockedObject<IPriceObservationStore>;
  let contributorContext: MockedObject<IContributorContextRepository>;
  let regionReference: MockedObject<IRegionReference>;
  let sut: IngestionService;

  beforeEach(() => {
    tenantContext = { setTenantId: vi.fn() };
    ledger = { claim: vi.fn(), setStatus: vi.fn() };
    storage = { presignPut: vi.fn(), presignGet: vi.fn(), headExists: vi.fn(), getObjectBytes: vi.fn(), deleteObject: vi.fn() };
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
      hasEmittedDuplicateByHash: vi.fn(),
      persistParsed: vi.fn(),
      confirmLocation: vi.fn(),
      getForReEmission: vi.fn(),
      markLocationResolved: vi.fn(),
      updateStatus: vi.fn(),
      softDelete: vi.fn(),
      listForTenant: vi.fn(),
      getDetail: vi.fn(),
    };
    priceObservationStore = { emit: vi.fn() };
    contributorContext = {
      getContext: vi.fn().mockResolvedValue({ optedOut: false, regionCode: 'NL-NB', countryCode: 'NL', trustScore: 50 }),
    };
    regionReference = {
      listCountries: vi.fn(),
      listSubdivisions: vi.fn(),
      isValidRegion: vi.fn(),
      isMappedLocation: vi.fn().mockResolvedValue(true),
    };
    sut = new IngestionService(
      tenantContext, ledger, storage,
      visionParser as unknown as VisionParseService,
      merchantResolver, productNormalizer, classifier, tagGenerator, invoiceRepo,
      priceObservationStore, contributorContext, regionReference,
    );
  });

  const arrangeHappyPath = (parseConfidence = 0.9, lowConfidence = false) => {
    ledger.claim.mockResolvedValue(true);
    storage.getObjectBytes.mockResolvedValue(new Uint8Array([1]));
    visionParser.parse.mockResolvedValue(receipt(parseConfidence));
    merchantResolver.resolve.mockResolvedValue({ merchantId: 'm1', branchId: 'b1', brandName: 'Albert Heijn', provisional: false, confidence: 0.9 });
    productNormalizer.normalize.mockResolvedValue({ lines: [normalizedLine(lowConfidence), normalizedLine()], suggestedTags: [] });
    classifier.classify.mockResolvedValue('groceries');
    tagGenerator.generate.mockResolvedValue(['weekly-groceries']);
    invoiceRepo.findFuzzyDuplicate.mockResolvedValue(false);
    invoiceRepo.hasEmittedDuplicateByHash.mockResolvedValue(false);
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

  it('flags an exact re-upload of an already-emitted receipt as SUSPECTED_DUPLICATE without emitting', async () => {
    arrangeHappyPath();
    invoiceRepo.hasEmittedDuplicateByHash.mockResolvedValue(true);
    const pricedLine: NormalizedLine = {
      productId: 'p1', categoryId: 'cat-dairy', baseUnit: 'L', packQuantity: 1,
      normalizedUnitPrice: 2.0, isDepositOrFee: false, productProvisional: false,
      confidence: 0.95, lowConfidence: false,
    };
    productNormalizer.normalize.mockResolvedValue({ lines: [pricedLine, normalizedLine()], suggestedTags: [] });

    const outcome = await sut.process(MESSAGE);

    expect(invoiceRepo.hasEmittedDuplicateByHash).toHaveBeenCalledWith('inv-1');
    expect(outcome.status).toBe('SUSPECTED_DUPLICATE');
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
  });

  it('does not emit price observations when no line yields a priced product', async () => {
    arrangeHappyPath(); // normalized lines have null productId

    await sut.process(MESSAGE);

    expect(contributorContext.getContext).toHaveBeenCalledWith('tenant-1');
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
  });

  it('emits a de-identified observation for a priced product line', async () => {
    arrangeHappyPath();
    const pricedLine: NormalizedLine = {
      productId: 'p1', categoryId: 'cat-dairy', baseUnit: 'L', packQuantity: 1,
      normalizedUnitPrice: 2.0, isDepositOrFee: false, productProvisional: false,
      confidence: 0.95, lowConfidence: false,
    };
    productNormalizer.normalize.mockResolvedValue({ lines: [pricedLine, normalizedLine()], suggestedTags: [] });

    await sut.process(MESSAGE);

    expect(priceObservationStore.emit).toHaveBeenCalledTimes(1);
    const rows = priceObservationStore.emit.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productId: 'p1', merchantId: 'm1', regionCode: 'NL-NB', quarantined: false });
  });

  it('does not emit price observations for a suspected duplicate', async () => {
    arrangeHappyPath();
    invoiceRepo.findFuzzyDuplicate.mockResolvedValue(true);
    const pricedLine: NormalizedLine = {
      productId: 'p1', categoryId: 'cat-dairy', baseUnit: 'L', packQuantity: 1,
      normalizedUnitPrice: 2.0, isDepositOrFee: false, productProvisional: false,
      confidence: 0.95, lowConfidence: false,
    };
    productNormalizer.normalize.mockResolvedValue({ lines: [pricedLine, normalizedLine()], suggestedTags: [] });

    const outcome = await sut.process(MESSAGE);

    expect(outcome.status).toBe('SUSPECTED_DUPLICATE');
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
  });

  it('flags NEEDS_REVIEW when the merchant was resolved provisionally', async () => {
    arrangeHappyPath();
    merchantResolver.resolve.mockResolvedValue({ merchantId: 'm-prov', branchId: null, brandName: 'Unknown Shop', provisional: true, confidence: 0.5 });

    const outcome = await sut.process(MESSAGE);

    expect(outcome.status).toBe('NEEDS_REVIEW');
  });

  it('persists location RESOLVED from the profile region and emits when mapped', async () => {
    arrangeHappyPath();
    const pricedLine: NormalizedLine = {
      productId: 'p1', categoryId: 'cat-dairy', baseUnit: 'L', packQuantity: 1,
      normalizedUnitPrice: 2.0, isDepositOrFee: false, productProvisional: false,
      confidence: 0.95, lowConfidence: false,
    };
    productNormalizer.normalize.mockResolvedValue({ lines: [pricedLine, normalizedLine()], suggestedTags: [] });

    await sut.process(MESSAGE);

    expect(regionReference.isMappedLocation).toHaveBeenCalledWith('NL', 'NL-NB');
    const persisted = invoiceRepo.persistParsed.mock.calls[0][0];
    expect(persisted.location).toEqual({ countryCode: 'NL', regionCode: 'NL-NB', status: 'RESOLVED', source: 'PROFILE' });
    expect(priceObservationStore.emit).toHaveBeenCalledTimes(1);
  });

  it('holds the invoice PENDING and defers emission when the profile region is unmapped', async () => {
    arrangeHappyPath();
    regionReference.isMappedLocation.mockResolvedValue(false);
    const pricedLine: NormalizedLine = {
      productId: 'p1', categoryId: 'cat-dairy', baseUnit: 'L', packQuantity: 1,
      normalizedUnitPrice: 2.0, isDepositOrFee: false, productProvisional: false,
      confidence: 0.95, lowConfidence: false,
    };
    productNormalizer.normalize.mockResolvedValue({ lines: [pricedLine, normalizedLine()], suggestedTags: [] });

    await sut.process(MESSAGE);

    const persisted = invoiceRepo.persistParsed.mock.calls[0][0];
    expect(persisted.location.status).toBe('PENDING');
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
  });

  it('persists the merchant + product provisional flags for faithful re-emission', async () => {
    arrangeHappyPath();
    merchantResolver.resolve.mockResolvedValue({ merchantId: 'm1', branchId: 'b1', brandName: 'Albert Heijn', provisional: true, confidence: 0.9 });
    const provisionalLine: NormalizedLine = {
      productId: 'p1', categoryId: 'cat-dairy', baseUnit: 'L', packQuantity: 1,
      normalizedUnitPrice: 2.0, isDepositOrFee: false, productProvisional: true,
      confidence: 0.95, lowConfidence: false,
    };
    productNormalizer.normalize.mockResolvedValue({ lines: [provisionalLine, normalizedLine()], suggestedTags: [] });

    await sut.process(MESSAGE);

    const persisted = invoiceRepo.persistParsed.mock.calls[0][0];
    expect(persisted.merchantProvisional).toBe(true);
    expect(persisted.lines[0].productProvisional).toBe(true);
  });
});
