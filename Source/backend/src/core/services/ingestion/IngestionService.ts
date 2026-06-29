import type { IIngestionLedger } from '../../ports/ingestion/IIngestionLedger';
import type { ITenantContext } from '../../ports/identity/ITenantContext';
import type { IS3FileStorage } from '../../ports/ingestion/IS3FileStorage';
import type { IMerchantResolver } from '../../ports/data-intelligence/IMerchantResolver';
import type { IProductNormalizer } from '../../ports/data-intelligence/IProductNormalizer';
import type { IInvoiceClassifier } from '../../ports/data-intelligence/IInvoiceClassifier';
import type { ITagGenerator } from '../../ports/data-intelligence/ITagGenerator';
import type { IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import type { IPriceObservationStore } from '../../ports/data-intelligence/IPriceObservationStore';
import type { IContributorContextRepository } from '../../ports/data-intelligence/IContributorContextRepository';
import type { IRegionReference } from '../../ports/data-intelligence/IRegionReference';
import type { IUploadLimitsProvider } from '../../ports/quota/IUploadLimitsProvider';
import type { IngestionMessage } from '../../ports/ingestion/IIngestionQueue';
import type { VisionParseService } from './VisionParseService';
import type { InvoiceStatus, ParsedReceipt } from '../../domain/ingestion';
import type { FailureReasonCode } from '../../domain/failureReasons';
import { ExtractionPreparer } from './ExtractionPreparer';
import { InvoiceFinalizer } from './InvoiceFinalizer';
import { OcrParserTool } from './agentic/tools/OcrParserTool';

export interface IngestionOutcome {
  handled: boolean; // false => duplicate SQS delivery, skipped
  status?: InvoiceStatus;
  // Set when the model returned an `unreadable` verdict (§03.2): the user-fault reason the
  // invoice was failed with. The model still ran, so the run is charged.
  failureReasonCode?: FailureReasonCode;
  receipt?: ParsedReceipt; // the vision-parse result, for debug logging at the handler
  // Emission-gate decision (§6.5), for plain structured logging at the handler.
  emissionGate?: { suppressed: boolean; integral: boolean; reasons: string[] };
}

// Runs the §6 pipeline for one receipt (legacy pipeline, pipeline_type='LEGACY'). The shared
// front (idempotency/parse/location) and tail (persist/emit) live in ExtractionPreparer and
// InvoiceFinalizer; this service owns only the direct, forced-order extraction in between —
// the same five stages the agentic coordinator wraps as tools. The caller owns the DB
// transaction; on a thrown error it is rolled back (ledger claim included), so SQS retry/DLQ
// stays correct and idempotency is preserved.
export class IngestionService {
  private readonly preparer: ExtractionPreparer;
  private readonly finalizer: InvoiceFinalizer;

  constructor(
    tenantContext: ITenantContext,
    ledger: IIngestionLedger,
    fileStorage: IS3FileStorage,
    visionParser: VisionParseService,
    // PDFs go to a document-capable model (the vision model rejects document blocks); both run
    // the same receipt prompt + schema, differing only in the model ID.
    documentParser: VisionParseService,
    private readonly merchantResolver: IMerchantResolver,
    private readonly productNormalizer: IProductNormalizer,
    private readonly classifier: IInvoiceClassifier,
    private readonly tagGenerator: ITagGenerator,
    invoiceRepo: IInvoiceRepository,
    priceObservationStore: IPriceObservationStore,
    contributorContext: IContributorContextRepository,
    regionReference: IRegionReference,
    uploadLimits: IUploadLimitsProvider,
  ) {
    this.preparer = new ExtractionPreparer(
      tenantContext, ledger, fileStorage, invoiceRepo, contributorContext, regionReference, uploadLimits,
      new OcrParserTool(visionParser, documentParser),
    );
    this.finalizer = new InvoiceFinalizer(invoiceRepo, priceObservationStore, ledger);
  }

  async process(message: IngestionMessage): Promise<IngestionOutcome> {
    const prepared = await this.preparer.prepare(message);
    if (prepared.kind === 'duplicate') return { handled: false };
    if (prepared.kind === 'unreadable') return prepared.outcome;

    const { receipt, location, context } = prepared;

    // Forced-order canonicalization (§6.2–6.10): merchant → product → classify → tag. The
    // sharing location is already resolved (the catalog is stamped with the invoice's country).
    const merchant = await this.merchantResolver.resolve(receipt.merchantRaw, location.countryCode);
    const { lines: normalized, suggestedTags } = await this.productNormalizer.normalize(merchant.merchantId, receipt.lines, location.countryCode);
    const categoryId = await this.classifier.classify({
      merchantId: merchant.merchantId,
      documentKindHint: receipt.documentKindHint,
      lines: receipt.lines,
      normalized,
    });
    const tags = await this.tagGenerator.generate({
      merchantId: merchant.merchantId,
      merchantBrand: merchant.brandName,
      categoryId,
      lines: receipt.lines,
      normalized,
      suggestedTags,
    });

    return this.finalizer.finalize({ message, receipt, location, context, merchant, normalized, categoryId, tags });
  }
}
