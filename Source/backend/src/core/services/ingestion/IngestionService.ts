import type { IIngestionLedger } from '../../ports/ingestion/IIngestionLedger';
import type { ITenantContext } from '../../ports/identity/ITenantContext';
import type { IS3FileStorage } from '../../ports/ingestion/IS3FileStorage';
import type { IMerchantResolver, MerchantResolution } from '../../ports/data-intelligence/IMerchantResolver';
import type { IProductNormalizer, NormalizedLine } from '../../ports/data-intelligence/IProductNormalizer';
import type { IInvoiceClassifier } from '../../ports/data-intelligence/IInvoiceClassifier';
import type { ITagGenerator } from '../../ports/data-intelligence/ITagGenerator';
import type { IInvoiceRepository, PersistedLine } from '../../ports/ingestion/IInvoiceRepository';
import type { IPriceObservationStore } from '../../ports/data-intelligence/IPriceObservationStore';
import type { IContributorContextRepository } from '../../ports/data-intelligence/IContributorContextRepository';
import type { IngestionMessage } from '../../ports/ingestion/IIngestionQueue';
import type { VisionParseService } from './VisionParseService';
import { decideStatus, isArithmeticConsistent, type InvoiceStatus, type ParsedLine, type ParsedReceipt } from '../../domain/ingestion';
import { buildPriceObservations, type ObservationLine } from '../../domain/priceObservation';

const LAUNCH_COUNTRY = 'NL';

export interface IngestionOutcome {
  handled: boolean; // false => duplicate SQS delivery, skipped
  status?: InvoiceStatus;
}

// Runs the §6 pipeline for one receipt. The caller owns the DB transaction; on a
// thrown error the transaction is rolled back (ledger claim included), so SQS
// retry/DLQ stays correct and idempotency is preserved.
export class IngestionService {
  constructor(
    private readonly tenantContext: ITenantContext,
    private readonly ledger: IIngestionLedger,
    private readonly fileStorage: IS3FileStorage,
    private readonly visionParser: VisionParseService,
    private readonly merchantResolver: IMerchantResolver,
    private readonly productNormalizer: IProductNormalizer,
    private readonly classifier: IInvoiceClassifier,
    private readonly tagGenerator: ITagGenerator,
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly priceObservationStore: IPriceObservationStore,
    private readonly contributorContext: IContributorContextRepository,
  ) {}

  async process(message: IngestionMessage): Promise<IngestionOutcome> {
    await this.tenantContext.setTenantId(message.tenantId);

    const claimed = await this.ledger.claim(message.s3Key, message.tenantId);
    if (!claimed) return { handled: false };

    const bytes = await this.fileStorage.getObjectBytes(message.s3Key);
    const receipt = await this.visionParser.parse(message.tenantId, { format: 'jpeg', bytes });

    const merchant = await this.merchantResolver.resolve(message.tenantId, receipt.merchantRaw, LAUNCH_COUNTRY);
    const { lines: normalized, suggestedTags } = await this.productNormalizer.normalize(message.tenantId, merchant.merchantId, receipt.lines);
    const categoryId = await this.classifier.classify(message.tenantId, {
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

    const isSuspectedDuplicate = await this.invoiceRepo.findFuzzyDuplicate(message.invoiceId, {
      merchantId: merchant.merchantId,
      transactionDate: receipt.transactionDate,
      total: receipt.total,
      lineCount: receipt.lines.length,
    });

    const status = decideStatus({
      parseConfidence: receipt.parseConfidence,
      arithmeticOk: isArithmeticConsistent(receipt),
      hasLowConfidenceLine: normalized.some(line => line.lowConfidence),
      lowConfidenceMerchant: merchant.provisional,
      isSuspectedDuplicate,
    });

    await this.invoiceRepo.persistParsed({
      invoiceId: message.invoiceId,
      merchantId: merchant.merchantId,
      branchId: merchant.branchId,
      transactionDate: receipt.transactionDate,
      currency: receipt.currency,
      total: receipt.total,
      categoryId,
      searchTags: tags,
      status,
      lines: receipt.lines.map((line, index) => toPersistedLine(line, normalized[index])),
    });

    // A suspected duplicate stays out of the price index until the user resolves it —
    // confirmed duplicates must contribute no observations (§6.8), and emitted rows are
    // de-identified and cannot be retracted.
    if (status !== 'SUSPECTED_DUPLICATE') {
      await this.emitPriceObservations(message.tenantId, merchant, receipt, normalized);
    }

    await this.ledger.setStatus(message.s3Key, 'DONE');
    return { handled: true, status };
  }

  // Stage 5 (§6.5): emit de-identified price observations into the RLS-exempt store.
  // The domain builder skips opt-out, missing-merchant, and non-priceable lines, and
  // quarantines provisional catalog entries.
  private async emitPriceObservations(
    tenantId: string,
    merchant: MerchantResolution,
    receipt: ParsedReceipt,
    normalized: NormalizedLine[],
  ): Promise<void> {
    const context = await this.contributorContext.getContext(tenantId);
    const rows = buildPriceObservations({
      merchantId: merchant.merchantId,
      merchantProvisional: merchant.provisional,
      transactionDate: receipt.transactionDate,
      currency: receipt.currency,
      lines: receipt.lines.map((line, index) => toObservationLine(line, normalized[index])),
      context,
    });
    if (rows.length > 0) await this.priceObservationStore.emit(rows);
  }
}

function toObservationLine(line: ParsedLine, norm: NormalizedLine): ObservationLine {
  return {
    productId: norm.productId,
    productProvisional: norm.productProvisional,
    baseUnit: norm.baseUnit,
    normalizedUnitPrice: norm.normalizedUnitPrice,
    isDepositOrFee: norm.isDepositOrFee,
    quantity: line.quantity,
    lineTotal: line.lineTotal,
    listUnitPrice: line.unitPrice ?? null,
  };
}

function toPersistedLine(line: ParsedLine, norm: NormalizedLine): PersistedLine {
  return {
    rawText: line.rawText,
    productId: norm.productId,
    categoryId: norm.categoryId,
    quantity: line.quantity,
    packQuantity: norm.packQuantity,
    baseUnit: norm.baseUnit,
    unitPrice: line.unitPrice ?? null,
    normalizedUnitPrice: norm.normalizedUnitPrice,
    lineTotal: line.lineTotal,
    isDiscount: line.lineTotal < 0,
    isDepositOrFee: norm.isDepositOrFee,
    confidence: norm.confidence,
  };
}
