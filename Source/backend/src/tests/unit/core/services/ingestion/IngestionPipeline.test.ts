import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { AgenticIngestionService } from '@core/services/ingestion/AgenticIngestionService';
import { ExtractionPreparer } from '@core/services/ingestion/ExtractionPreparer';
import { InvoiceFinalizer } from '@core/services/ingestion/InvoiceFinalizer';
import { InvoiceCoordinator } from '@core/services/ingestion/agentic/InvoiceCoordinator';
import { OcrParserTool } from '@core/services/ingestion/agentic/tools/OcrParserTool';
import { MerchantResolverTool } from '@core/services/ingestion/agentic/tools/MerchantResolverTool';
import { ProductNormalizerTool } from '@core/services/ingestion/agentic/tools/ProductNormalizerTool';
import { InvoiceClassifierTool } from '@core/services/ingestion/agentic/tools/InvoiceClassifierTool';
import { SearchTagGeneratorTool } from '@core/services/ingestion/agentic/tools/SearchTagGeneratorTool';
import { CurrencyHarmonizationService } from '@core/services/fx/CurrencyHarmonizationService';
import type { IReceiptParser } from '@core/ports/ingestion/IReceiptParser';
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
import type { IUploadLimitsProvider } from '@core/ports/quota/IUploadLimitsProvider';
import type { ParsedReceipt } from '@core/domain/ingestion';
import { OversizeUploadError, TooManyPagesError, UnsupportedUploadTypeError } from '@core/domain/errors';
import { DEFAULT_ESCALATION_THRESHOLDS } from '@core/domain/visionEscalation';

const MESSAGE = { invoiceId: 'inv-1', tenantId: 'tenant-1', s3Key: 'receipts/tenant-1/abc.jpg' };

// total 3.0 = 4.0 + (-1.0); line 2 is a discount with no unit_price.
const receipt = (parseConfidence = 0.9): ParsedReceipt => ({
  merchantRaw: 'Albert Heijn',
  transactionDate: '2026-06-10',
  currency: 'EUR',
  total: 3.0,
  location: { countryCode: 'NL', regionText: 'Noord-Brabant' },
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
  sizeSource: null,
  isDepositOrFee: false,
  productProvisional: false,
  confidence: 0,
  lowConfidence,
});

describe('Ingestion pipeline (agentic: preparer + coordinator + finalizer)', () => {
  let tenantContext: MockedObject<ITenantContext>;
  let ledger: MockedObject<IIngestionLedger>;
  let storage: MockedObject<IS3FileStorage>;
  let visionParser: { parse: ReturnType<typeof vi.fn> };
  let documentParser: { parse: ReturnType<typeof vi.fn> };
  let merchantResolver: MockedObject<IMerchantResolver>;
  let productNormalizer: MockedObject<IProductNormalizer>;
  let classifier: MockedObject<IInvoiceClassifier>;
  let tagGenerator: MockedObject<ITagGenerator>;
  let invoiceRepo: MockedObject<IInvoiceRepository>;
  let priceObservationStore: MockedObject<IPriceObservationStore>;
  let contributorContext: MockedObject<IContributorContextRepository>;
  let regionReference: MockedObject<IRegionReference>;
  let uploadLimits: MockedObject<IUploadLimitsProvider>;
  let sut: AgenticIngestionService;
  let buildSut: (escalationEnabled: boolean) => AgenticIngestionService;

  beforeEach(() => {
    tenantContext = { setTenantId: vi.fn() };
    ledger = { claim: vi.fn(), setStatus: vi.fn(), release: vi.fn() };
    storage = { presignPost: vi.fn(), presignGet: vi.fn(), headObject: vi.fn(), getObjectBytes: vi.fn(), deleteObject: vi.fn() };
    visionParser = { parse: vi.fn() };
    documentParser = { parse: vi.fn() };
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
      markUnreadable: vi.fn(),
      markFailed: vi.fn(),
      markRetake: vi.fn(),
      quarantine: vi.fn(),
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
      resolveReceiptLocation: vi.fn(),
    };
    uploadLimits = {
      getMaxImageBytes: vi.fn().mockResolvedValue(5_000_000),
      getMaxPdfBytes: vi.fn().mockResolvedValue(4_500_000),
      getMaxPdfPages: vi.fn().mockResolvedValue(10),
    };
    const fxRates = { upsertDaily: vi.fn(), latestOnOrBefore: vi.fn().mockResolvedValue(1) };
    // escalationEnabled defaults true; the Qwen-only case rebuilds with false to prove the Layer C
    // retake gate is inert without a fallback tier.
    buildSut = (escalationEnabled: boolean) => {
      const preparer = new ExtractionPreparer(
        tenantContext, ledger, storage, invoiceRepo, contributorContext, regionReference, uploadLimits,
        new OcrParserTool(visionParser as unknown as IReceiptParser, documentParser as unknown as IReceiptParser),
        DEFAULT_ESCALATION_THRESHOLDS,
        escalationEnabled,
      );
      const coordinator = new InvoiceCoordinator(
        new MerchantResolverTool(merchantResolver),
        new ProductNormalizerTool(productNormalizer),
        new InvoiceClassifierTool(classifier),
        new SearchTagGeneratorTool(tagGenerator),
        { recordStageOutcome: vi.fn() },
      );
      const finalizer = new InvoiceFinalizer(
        invoiceRepo, priceObservationStore, ledger, new CurrencyHarmonizationService(fxRates),
      );
      return new AgenticIngestionService(preparer, coordinator, finalizer);
    };
    sut = buildSut(true);
  });

  const arrangeHappyPath = (parseConfidence = 0.9, lowConfidence = false) => {
    ledger.claim.mockResolvedValue(true);
    storage.getObjectBytes.mockResolvedValue(new Uint8Array([1]));
    visionParser.parse.mockResolvedValue(receipt(parseConfidence));
    documentParser.parse.mockResolvedValue(receipt(parseConfidence));
    merchantResolver.resolve.mockResolvedValue({ merchantId: 'm1', brandName: 'Albert Heijn', defaultCategoryId: null, provisional: false, confidence: 0.9 });
    productNormalizer.normalize.mockResolvedValue({ lines: [normalizedLine(lowConfidence), normalizedLine()], suggestedTags: [] });
    classifier.classify.mockResolvedValue('groceries');
    tagGenerator.generate.mockResolvedValue(['weekly-groceries']);
    invoiceRepo.findFuzzyDuplicate.mockResolvedValue(false);
    invoiceRepo.hasEmittedDuplicateByHash.mockResolvedValue(false);
    // No upload-geo on the row by default; the receipt address resolves (tier 1).
    invoiceRepo.getById.mockResolvedValue(null);
    regionReference.resolveReceiptLocation.mockResolvedValue({ countryCode: 'NL', regionCode: 'NL-NB' });
  };

  it('short-circuits a duplicate SQS delivery after setting tenant context', async () => {
    ledger.claim.mockResolvedValue(false);

    const outcome = await sut.process(MESSAGE);

    expect(outcome).toEqual({ handled: false });
    expect(tenantContext.setTenantId).toHaveBeenCalledWith('tenant-1');
    expect(storage.getObjectBytes).not.toHaveBeenCalled();
  });

  it('fails an unreadable verdict as user-fault FAILED_PROCESSING and skips the pipeline', async () => {
    ledger.claim.mockResolvedValue(true);
    storage.getObjectBytes.mockResolvedValue(new Uint8Array([1]));
    visionParser.parse.mockResolvedValue({ unreadable: true, reason: 'BLURRY' });

    const outcome = await sut.process(MESSAGE);

    expect(outcome).toEqual({ handled: true, status: 'FAILED_PROCESSING', failureReasonCode: 'BLURRY' });
    expect(invoiceRepo.markUnreadable).toHaveBeenCalledWith('inv-1', 'BLURRY');
    // Nothing downstream ran — no canonicalization, no persist, no emission — but the
    // ledger is marked DONE so a redelivery short-circuits (and the run is still charged).
    expect(merchantResolver.resolve).not.toHaveBeenCalled();
    expect(invoiceRepo.persistParsed).not.toHaveBeenCalled();
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
    expect(ledger.setStatus).toHaveBeenCalledWith(MESSAGE.s3Key, 'DONE');
  });

  it('suggests a retake (Layer C) for a GROSSLY broken photo parse, skipping the pipeline', async () => {
    ledger.claim.mockResolvedValue(true);
    storage.getObjectBytes.mockResolvedValue(new Uint8Array([1]));
    // Lines sum to 3.0 but the receipt total is 99.99 → ~97% residual, far beyond correctable.
    visionParser.parse.mockResolvedValue({ ...receipt(0.9), total: 99.99 });

    const outcome = await sut.process(MESSAGE);

    expect(outcome).toEqual({ handled: true, status: 'RETAKE_SUGGESTED', failureReasonCode: 'RETAKE_LOW_QUALITY' });
    expect(invoiceRepo.markRetake).toHaveBeenCalledWith('inv-1');
    // No canonicalization, no persist, no emission — but the ledger is marked DONE.
    expect(merchantResolver.resolve).not.toHaveBeenCalled();
    expect(invoiceRepo.persistParsed).not.toHaveBeenCalled();
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
    expect(ledger.setStatus).toHaveBeenCalledWith(MESSAGE.s3Key, 'DONE');
  });

  it('does NOT retake in a Qwen-only deployment (escalation disabled) — flows to the normal path', async () => {
    sut = buildSut(false); // no fallback tier provisioned → Layer C gate inert (identical to today)
    arrangeHappyPath();
    visionParser.parse.mockResolvedValue({ ...receipt(0.9), total: 99.99 }); // grossly broken

    const outcome = await sut.process(MESSAGE);

    expect(invoiceRepo.markRetake).not.toHaveBeenCalled();
    expect(invoiceRepo.persistParsed).toHaveBeenCalled(); // canonicalized + persisted (→ review), not discarded
  });

  it('does NOT suggest a retake for a broken PDF parse (retake copy is meaningless for a document)', async () => {
    ledger.claim.mockResolvedValue(true);
    storage.getObjectBytes.mockResolvedValue(new Uint8Array([1]));
    documentParser.parse.mockResolvedValue({ ...receipt(0.9), total: 99.99 });
    merchantResolver.resolve.mockResolvedValue({ merchantId: 'm1', brandName: 'AH', defaultCategoryId: null, provisional: false, confidence: 0.9 });
    productNormalizer.normalize.mockResolvedValue({ lines: [normalizedLine(), normalizedLine()], suggestedTags: [] });
    classifier.classify.mockResolvedValue('groceries');
    tagGenerator.generate.mockResolvedValue([]);
    invoiceRepo.findFuzzyDuplicate.mockResolvedValue(false);
    invoiceRepo.hasEmittedDuplicateByHash.mockResolvedValue(false);
    invoiceRepo.getById.mockResolvedValue(null);
    regionReference.resolveReceiptLocation.mockResolvedValue({ countryCode: 'NL', regionCode: 'NL-NB' });

    const outcome = await sut.process({ ...MESSAGE, s3Key: 'receipts/tenant-1/abc.pdf' });

    expect(invoiceRepo.markRetake).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ handled: true }); // flows to the normal persist path
  });

  it('persists a PARSED invoice and maps lines (discount + unit price) on the happy path', async () => {
    arrangeHappyPath();

    const outcome = await sut.process(MESSAGE);

    expect(outcome).toMatchObject({ handled: true, status: 'PARSED' });
    expect(invoiceRepo.findFuzzyDuplicate).toHaveBeenCalledWith('inv-1', {
      merchantId: 'm1', transactionDate: '2026-06-10', total: 3.0, lineCount: 2,
    });
    const persisted = invoiceRepo.persistParsed.mock.calls[0][0];
    expect(persisted.status).toBe('PARSED');
    expect(persisted.priceEmissionBlocked).toBe(false);
    expect(persisted.searchTags).toEqual(['weekly-groceries']);
    expect(persisted.lines[0]).toMatchObject({ lineIndex: 0, unitPrice: 2.0, isDiscount: false });
    // Negative line → discount; category is forced to the deterministic discount leaf.
    expect(persisted.lines[1]).toMatchObject({ lineIndex: 1, unitPrice: null, isDiscount: true, categoryId: 'cat-other-discount' });
    expect(ledger.setStatus).toHaveBeenCalledWith(MESSAGE.s3Key, 'DONE');
  });

  it('sends a PDF to the document parser as a document attachment', async () => {
    arrangeHappyPath();

    await sut.process({ ...MESSAGE, s3Key: 'receipts/tenant-1/abc.pdf' });

    expect(documentParser.parse).toHaveBeenCalledWith(
      { format: 'pdf', bytes: expect.any(Uint8Array), name: 'receipt' },
      expect.objectContaining({ countryCode: 'NL' }),
    );
    expect(visionParser.parse).not.toHaveBeenCalled();
  });

  it('sends an image to the vision parser as an image attachment', async () => {
    arrangeHappyPath();

    await sut.process(MESSAGE);

    expect(visionParser.parse).toHaveBeenCalledWith(
      { format: 'jpeg', bytes: expect.any(Uint8Array) },
      expect.objectContaining({ countryCode: 'NL' }),
    );
    expect(documentParser.parse).not.toHaveBeenCalled();
  });

  it('forces a deposit line to the per-macro deposit category, keeping the macro', async () => {
    arrangeHappyPath();
    const depositLine: NormalizedLine = { ...normalizedLine(), categoryId: 'cat-beverages', isDepositOrFee: true };
    productNormalizer.normalize.mockResolvedValue({ lines: [depositLine, normalizedLine()], suggestedTags: [] });

    await sut.process(MESSAGE);

    const persisted = invoiceRepo.persistParsed.mock.calls[0][0];
    expect(persisted.lines[0]).toMatchObject({ isDepositOrFee: true, categoryId: 'cat-groceries-deposit' });
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

  it('treats an exact re-upload of a deleted receipt as normal but blocks re-emission', async () => {
    arrangeHappyPath();
    invoiceRepo.hasEmittedDuplicateByHash.mockResolvedValue(true);
    const pricedLine: NormalizedLine = {
      productId: 'p1', categoryId: 'cat-dairy', baseUnit: 'L', packQuantity: 1,
      sizeSource: null, isDepositOrFee: false, productProvisional: false,
      confidence: 0.95, lowConfidence: false,
    };
    productNormalizer.normalize.mockResolvedValue({ lines: [pricedLine, normalizedLine()], suggestedTags: [] });

    const outcome = await sut.process(MESSAGE);

    expect(invoiceRepo.hasEmittedDuplicateByHash).toHaveBeenCalledWith('inv-1');
    // Not flagged as a duplicate — the original was deleted, nothing to compare against.
    expect(outcome.status).toBe('PARSED');
    const persisted = invoiceRepo.persistParsed.mock.calls[0][0];
    expect(persisted.priceEmissionBlocked).toBe(true);
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
      sizeSource: null, isDepositOrFee: false, productProvisional: false,
      confidence: 0.95, lowConfidence: false,
    };
    productNormalizer.normalize.mockResolvedValue({ lines: [pricedLine, normalizedLine()], suggestedTags: [] });

    await sut.process(MESSAGE);

    expect(priceObservationStore.emit).toHaveBeenCalledTimes(1);
    const rows = priceObservationStore.emit.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productId: 'p1', merchantId: 'm1', regionCode: 'NL-NB', quarantined: false });
  });

  it('suppresses all emission for a non-integral parse (low confidence) and reports the gate', async () => {
    arrangeHappyPath(0.5); // below visionMin → whole receipt indicted
    const priced: NormalizedLine = {
      productId: 'p1', categoryId: 'cat-dairy', baseUnit: 'L', packQuantity: 1,
      sizeSource: null, isDepositOrFee: false, productProvisional: false,
      confidence: 0.95, lowConfidence: false,
    };
    productNormalizer.normalize.mockResolvedValue({ lines: [priced, normalizedLine()], suggestedTags: [] });

    const outcome = await sut.process(MESSAGE);

    expect(priceObservationStore.emit).not.toHaveBeenCalled();
    expect(outcome.emissionGate).toMatchObject({ suppressed: true, integral: false, reasons: ['low_parse_confidence'] });
  });

  it('reports an integral gate when a confident, arithmetic-consistent receipt emits', async () => {
    arrangeHappyPath();
    productNormalizer.normalize.mockResolvedValue({ lines: [pricedLine(), normalizedLine()], suggestedTags: [] });

    const outcome = await sut.process(MESSAGE);

    expect(priceObservationStore.emit).toHaveBeenCalledTimes(1);
    expect(outcome.emissionGate).toMatchObject({ suppressed: false, integral: true, reasons: [] });
  });

  it('does not emit price observations for a suspected duplicate', async () => {
    arrangeHappyPath();
    invoiceRepo.findFuzzyDuplicate.mockResolvedValue(true);
    const pricedLine: NormalizedLine = {
      productId: 'p1', categoryId: 'cat-dairy', baseUnit: 'L', packQuantity: 1,
      sizeSource: null, isDepositOrFee: false, productProvisional: false,
      confidence: 0.95, lowConfidence: false,
    };
    productNormalizer.normalize.mockResolvedValue({ lines: [pricedLine, normalizedLine()], suggestedTags: [] });

    const outcome = await sut.process(MESSAGE);

    expect(outcome.status).toBe('SUSPECTED_DUPLICATE');
    expect(invoiceRepo.persistParsed.mock.calls[0][0].priceEmissionBlocked).toBe(true);
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
  });

  it('flags NEEDS_REVIEW when the merchant was resolved provisionally', async () => {
    arrangeHappyPath();
    merchantResolver.resolve.mockResolvedValue({ merchantId: 'm-prov', brandName: 'Unknown Shop', defaultCategoryId: null, provisional: true, confidence: 0.5 });

    const outcome = await sut.process(MESSAGE);

    expect(outcome.status).toBe('NEEDS_REVIEW');
  });

  const pricedLine = (): NormalizedLine => ({
    productId: 'p1', categoryId: 'cat-dairy', baseUnit: 'L', packQuantity: 1,
    normalizedUnitPrice: 2.0, isDepositOrFee: false, productProvisional: false,
    confidence: 0.95, lowConfidence: false,
  });

  it('tier 1: resolves location from the receipt address and emits with the receipt region', async () => {
    arrangeHappyPath();
    // A BR/Bahia contributor scanning a Dutch receipt — the printed address wins.
    contributorContext.getContext.mockResolvedValue({ optedOut: false, regionCode: 'BR-BA', countryCode: 'BR', trustScore: 50 });
    productNormalizer.normalize.mockResolvedValue({ lines: [pricedLine(), normalizedLine()], suggestedTags: [] });

    await sut.process(MESSAGE);

    const persisted = invoiceRepo.persistParsed.mock.calls[0][0];
    expect(persisted.location).toEqual({ countryCode: 'NL', regionCode: 'NL-NB', status: 'RESOLVED', source: 'RECEIPT' });
    expect(priceObservationStore.emit).toHaveBeenCalledTimes(1);
    // Emitted against the receipt region, never the contributor's BR/Bahia profile.
    expect(priceObservationStore.emit.mock.calls[0][0][0]).toMatchObject({ countryCode: 'NL', regionCode: 'NL-NB' });
  });

  it('stamps merchant + product with the resolved invoice country (no NL launch default)', async () => {
    arrangeHappyPath();
    // No receipt country and no upload-geo → the profile country (BR) is the invoice's
    // country. The catalog must be stamped with it, proving location resolves BEFORE the
    // merchant/product writes and that the old hardcoded launch country is gone.
    contributorContext.getContext.mockResolvedValue({ optedOut: false, regionCode: 'BR-BA', countryCode: 'BR', trustScore: 50 });
    regionReference.resolveReceiptLocation.mockResolvedValue({ countryCode: null, regionCode: null });
    invoiceRepo.getById.mockResolvedValue(null);

    await sut.process(MESSAGE);

    expect(merchantResolver.resolve).toHaveBeenCalledWith(expect.anything(), 'BR');
    expect(productNormalizer.normalize).toHaveBeenCalledWith('m1', expect.anything(), 'BR', expect.anything());
  });

  it('tier 1: keeps the receipt city out of tags and stores it as searchCity', async () => {
    arrangeHappyPath();
    visionParser.parse.mockResolvedValue({ ...receipt(), location: { countryCode: 'NL', regionText: 'Noord-Brabant', city: 'Eindhoven' } });

    await sut.process(MESSAGE);

    const persisted = invoiceRepo.persistParsed.mock.calls[0][0];
    expect(persisted.searchTags).toEqual(['weekly-groceries']);
    expect(persisted.searchCity).toBe('Eindhoven');
  });

  it('sets searchCity to null when the receipt prints no city', async () => {
    arrangeHappyPath();

    await sut.process(MESSAGE);

    expect(invoiceRepo.persistParsed.mock.calls[0][0].searchCity).toBeNull();
  });

  it('tier 2: no receipt region but upload-geo on the row → PENDING/GEO, no emit', async () => {
    arrangeHappyPath();
    regionReference.resolveReceiptLocation.mockResolvedValue({ countryCode: null, regionCode: null });
    invoiceRepo.getById.mockResolvedValue({ uploadCountryCode: 'NL', uploadRegionCode: 'NL-NB' } as never);
    productNormalizer.normalize.mockResolvedValue({ lines: [pricedLine(), normalizedLine()], suggestedTags: [] });

    await sut.process(MESSAGE);

    const persisted = invoiceRepo.persistParsed.mock.calls[0][0];
    expect(persisted.location).toEqual({ countryCode: 'NL', regionCode: 'NL-NB', status: 'PENDING', source: 'GEO' });
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
  });

  it('tier 3: no receipt region and no upload-geo → PENDING/PROFILE, no emit', async () => {
    arrangeHappyPath();
    regionReference.resolveReceiptLocation.mockResolvedValue({ countryCode: null, regionCode: null });
    invoiceRepo.getById.mockResolvedValue(null);
    productNormalizer.normalize.mockResolvedValue({ lines: [pricedLine(), normalizedLine()], suggestedTags: [] });

    await sut.process(MESSAGE);

    const persisted = invoiceRepo.persistParsed.mock.calls[0][0];
    expect(persisted.location).toEqual({ countryCode: 'NL', regionCode: 'NL-NB', status: 'PENDING', source: 'PROFILE' });
    expect(priceObservationStore.emit).not.toHaveBeenCalled();
  });

  it('persists the merchant + product provisional flags for faithful re-emission', async () => {
    arrangeHappyPath();
    merchantResolver.resolve.mockResolvedValue({ merchantId: 'm1', brandName: 'Albert Heijn', defaultCategoryId: null, provisional: true, confidence: 0.9 });
    const provisionalLine: NormalizedLine = {
      productId: 'p1', categoryId: 'cat-dairy', baseUnit: 'L', packQuantity: 1,
      sizeSource: null, isDepositOrFee: false, productProvisional: true,
      confidence: 0.95, lowConfidence: false,
    };
    productNormalizer.normalize.mockResolvedValue({ lines: [provisionalLine, normalizedLine()], suggestedTags: [] });

    await sut.process(MESSAGE);

    const persisted = invoiceRepo.persistParsed.mock.calls[0][0];
    expect(persisted.merchantProvisional).toBe(true);
    expect(persisted.lines[0].productProvisional).toBe(true);
  });

  // §06 pre-AI validation: every breach throws a user-fault error BEFORE any model call.
  it('routes a PDF through the document parser (not the vision parser)', async () => {
    arrangeHappyPath();

    const outcome = await sut.process({ ...MESSAGE, s3Key: 'receipts/tenant-1/abc.pdf' });

    expect(documentParser.parse).toHaveBeenCalled();
    expect(visionParser.parse).not.toHaveBeenCalled();
    expect(outcome.status).toBe('PARSED');
  });

  describe('pre-AI upload validation (§06)', () => {
    const arrangeBytes = (bytes: Uint8Array) => {
      ledger.claim.mockResolvedValue(true);
      storage.getObjectBytes.mockResolvedValue(bytes);
    };

    it('rejects an oversize image with OversizeUploadError before parsing', async () => {
      arrangeBytes(new Uint8Array(6_000_000));
      uploadLimits.getMaxImageBytes.mockResolvedValue(5_000_000);

      await expect(sut.process(MESSAGE)).rejects.toBeInstanceOf(OversizeUploadError);
      expect(visionParser.parse).not.toHaveBeenCalled();
    });

    it('rejects a HEIC that reached the worker with UnsupportedUploadTypeError', async () => {
      arrangeBytes(new Uint8Array([1, 2, 3]));

      await expect(
        sut.process({ ...MESSAGE, s3Key: 'receipts/tenant-1/abc.heic' }),
      ).rejects.toBeInstanceOf(UnsupportedUploadTypeError);
      expect(visionParser.parse).not.toHaveBeenCalled();
    });

    it('rejects a PDF over the page cap with TooManyPagesError before parsing', async () => {
      const threePages = new TextEncoder().encode('/Type /Page /Type/Page /Type /Page');
      arrangeBytes(threePages);
      uploadLimits.getMaxPdfPages.mockResolvedValue(2);

      await expect(
        sut.process({ ...MESSAGE, s3Key: 'receipts/tenant-1/abc.pdf' }),
      ).rejects.toBeInstanceOf(TooManyPagesError);
      expect(documentParser.parse).not.toHaveBeenCalled();
    });
  });
});
