import type { IIngestionLedger } from '../../ports/ingestion/IIngestionLedger';
import type { ITenantContext } from '../../ports/identity/ITenantContext';
import type { IS3FileStorage } from '../../ports/ingestion/IS3FileStorage';
import type { IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import type { IContributorContextRepository } from '../../ports/data-intelligence/IContributorContextRepository';
import type { IRegionReference } from '../../ports/data-intelligence/IRegionReference';
import type { IUploadLimitsProvider } from '../../ports/quota/IUploadLimitsProvider';
import type { IngestionMessage } from '../../ports/ingestion/IIngestionQueue';
import type { OcrParserTool } from './agentic/tools/OcrParserTool';
import type { IngestionOutcome } from './IngestionService';
import { isUnreadableVerdict, type ParsedReceipt } from '../../domain/ingestion';
import { resolveIngestionLocation, type LocationCandidate, type ResolvedIngestionLocation } from '../../domain/region';
import { attachmentFormatFromKey, type UploadFormat } from '../../domain/uploadFormat';
import { countPdfPages } from '../../domain/pdf';
import { OversizeUploadError, TooManyPagesError } from '../../domain/errors';
import type { ContributorContext } from '../../domain/priceObservation';

// The shared, pipeline-agnostic front of the §6 pipeline: idempotency claim, pre-AI upload
// validation, vision/PDF parse, the `unreadable` early-exit, and location resolution — the
// inputs both the legacy direct extractor and the agentic coordinator need before the
// canonicalization stages. Extracted from IngestionService so both stay in lock-step.
export type PrepareResult =
  | { kind: 'duplicate' } // duplicate SQS delivery (ledger already claimed)
  | { kind: 'unreadable'; outcome: IngestionOutcome } // model judged the image unreadable
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
    private readonly ocr: OcrParserTool,
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

    const parsed = await this.ocr.parse(format, bytes, { countryCode: context.countryCode, processedDate });

    // A model ran, so the run is charged, but there is nothing to canonicalize or emit: fail
    // the invoice with the user-fault reason and stop. Not a system fault — stays deletable.
    if (isUnreadableVerdict(parsed)) {
      await this.invoiceRepo.markUnreadable(message.invoiceId, parsed.reason);
      await this.ledger.setStatus(message.s3Key, 'DONE');
      return { kind: 'unreadable', outcome: { handled: true, status: 'FAILED_PROCESSING', failureReasonCode: parsed.reason } };
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
