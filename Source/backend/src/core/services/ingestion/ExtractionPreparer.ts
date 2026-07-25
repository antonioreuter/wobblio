import type { IIngestionLedger } from '../../ports/ingestion/IIngestionLedger';
import type { ITenantContext } from '../../ports/identity/ITenantContext';
import type { IS3FileStorage } from '../../ports/ingestion/IS3FileStorage';
import type { IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import type { IContributorContextRepository } from '../../ports/data-intelligence/IContributorContextRepository';
import type { IRegionReference } from '../../ports/data-intelligence/IRegionReference';
import type { IUploadLimitsProvider } from '../../ports/quota/IUploadLimitsProvider';
import type { IProcessingProgress } from '../../ports/ingestion/IProcessingProgress';
import type { IngestionMessage } from '../../ports/ingestion/IIngestionQueue';
import type { OcrParserTool } from './agentic/tools/OcrParserTool';
import type { IngestionOutcome } from './InvoiceFinalizer';
import { isUnreadableVerdict, type ParsedReceipt } from '../../domain/ingestion';
import { isRetakeSuggested } from '../../domain/receiptEscalation';
import type { EscalationThresholds } from '../../domain/visionEscalation';
import { resolveIngestionLocation, type LocationCandidate, type ResolvedIngestionLocation } from '../../domain/region';
import { attachmentFormatFromKey, type UploadFormat } from '../../domain/uploadFormat';
import { countPdfPages } from '../../domain/pdf';
import { OversizeUploadError, TooManyPagesError } from '../../domain/errors';
import type { ContributorContext } from '../../domain/priceObservation';

// The shared, pipeline-agnostic front of the §6 pipeline: idempotency claim, pre-AI upload
// validation, vision/PDF parse, the `unreadable` early-exit, and location resolution — the
// shared front the agentic coordinator runs before the canonicalization stages.
export type PrepareResult =
  | { kind: 'duplicate' } // duplicate SQS delivery (ledger already claimed)
  | { kind: 'unreadable'; outcome: IngestionOutcome } // model judged the image unreadable
  | { kind: 'retake'; outcome: IngestionOutcome } // photo parse still objectively broken after escalation
  | { kind: 'ready'; receipt: ParsedReceipt; location: ResolvedIngestionLocation; context: ContributorContext };

export class ExtractionPreparer {
  constructor(
    private readonly tenantContext: ITenantContext,
    private readonly ledger: IIngestionLedger,
    private readonly fileStorage: IS3FileStorage,
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly contributorContext: IContributorContextRepository,
    private readonly regionReference: IRegionReference,
    private readonly uploadLimits: IUploadLimitsProvider,
    private readonly progress: IProcessingProgress,
    private readonly ocr: OcrParserTool,
    private readonly escalationThresholds: EscalationThresholds,
    // Whether any escalation tier is provisioned. The Layer C retake gate only runs when it is:
    // a photo is asked to be re-taken only after our STRONGEST available model has also failed —
    // so a primary-only (Qwen-only) deployment behaves exactly as before (→ NEEDS_REVIEW, no retake).
    private readonly escalationEnabled: boolean,
  ) {}

  async prepare(message: IngestionMessage): Promise<PrepareResult> {
    await this.tenantContext.setTenantId(message.tenantId);

    const claimed = await this.ledger.claim(message.s3Key, message.tenantId);
    if (!claimed) return { kind: 'duplicate' };

    const context = await this.contributorContext.getContext(message.tenantId);
    const processedDate = new Date().toISOString().slice(0, 10);

    const bytes = await this.fileStorage.getObjectBytes(message.s3Key);
    const format = attachmentFormatFromKey(message.s3Key);
    await this.assertUploadWithinLimits(message.invoiceId, format, bytes);

    // The stage the user waits longest in (~10s of the ~18s): flip it before the model call, not
    // after, so the label is honest while the wait is happening. Past the ledger claim, so a
    // duplicate delivery never rewrites the progress of the run that actually owns the invoice.
    // `.catch`: the port promises never to throw, but nothing outside this call site enforces it
    // and a lost label must never cost an ingestion.
    await this.progress.recordStage(message.invoiceId, message.tenantId, 'READING').catch(() => undefined);

    const parsed = await this.ocr.parse(format, bytes, { countryCode: context.countryCode, processedDate });

    // A model ran, so the run is charged, but there is nothing to canonicalize or emit: fail
    // the invoice with the user-fault reason and stop. Not a system fault — stays deletable.
    if (isUnreadableVerdict(parsed)) {
      await this.invoiceRepo.markUnreadable(message.invoiceId, parsed.reason);
      await this.ledger.setStatus(message.s3Key, 'DONE');
      return { kind: 'unreadable', outcome: { handled: true, status: 'FAILED_PROCESSING', failureReasonCode: parsed.reason } };
    }

    // Fix 11 Layer C: a photo whose parse is GROSSLY broken even after our strongest model ran.
    // Ask for a retake instead of canonicalizing garbage into review — and short-circuit before the
    // aux-model stages, saving their tokens. Gated to escalation-enabled deployments so a Qwen-only
    // config is unchanged, and to photos ("retake flat / in sections" is meaningless for a PDF). The
    // run is still charged when a fallback model ran (worker; the no-charge case is primary-only).
    if (this.escalationEnabled && format !== 'pdf' && isRetakeSuggested(parsed, this.escalationThresholds)) {
      await this.invoiceRepo.markRetake(message.invoiceId);
      await this.ledger.setStatus(message.s3Key, 'DONE');
      return { kind: 'retake', outcome: { handled: true, status: 'RETAKE_SUGGESTED', failureReasonCode: 'RETAKE_LOW_QUALITY' } };
    }

    const location = await this.resolveLocation(message.invoiceId, parsed, context);
    return { kind: 'ready', receipt: parsed, location, context };
  }

  private async assertUploadWithinLimits(invoiceId: string, format: UploadFormat, bytes: Uint8Array): Promise<void> {
    const isPdf = format === 'pdf';
    const maxBytes = isPdf ? await this.uploadLimits.getMaxPdfBytes() : await this.uploadLimits.getMaxImageBytes();
    if (bytes.length > maxBytes) throw new OversizeUploadError(invoiceId, bytes.length, maxBytes);

    if (!isPdf) return;
    const maxPages = await this.uploadLimits.getMaxPdfPages();
    const pages = countPdfPages(bytes);
    if (pages > maxPages) throw new TooManyPagesError(invoiceId, pages, maxPages);
  }

  private async resolveLocation(invoiceId: string, receipt: ParsedReceipt, context: ContributorContext): Promise<ResolvedIngestionLocation> {
    const receiptResolved = await this.regionReference.resolveReceiptLocation({
      countryCode: receipt.location?.countryCode,
      regionText: receipt.location?.regionText,
    });
    const record = await this.invoiceRepo.getById(invoiceId);
    const uploadGeo: LocationCandidate | null = record?.uploadCountryCode
      ? { countryCode: record.uploadCountryCode, regionCode: record.uploadRegionCode }
      : null;
    return resolveIngestionLocation({
      receipt: receiptResolved,
      uploadGeo,
      profile: { countryCode: context.countryCode, regionCode: context.regionCode },
    });
  }
}
