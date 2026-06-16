import type { IIngestionLedger } from '../ports/IIngestionLedger';
import type { ITenantContext } from '../ports/ITenantContext';
import type { IS3FileStorage } from '../ports/IS3FileStorage';
import type { IMerchantResolver } from '../ports/IMerchantResolver';
import type { IProductNormalizer, NormalizedLine } from '../ports/IProductNormalizer';
import type { IInvoiceClassifier } from '../ports/IInvoiceClassifier';
import type { ITagGenerator } from '../ports/ITagGenerator';
import type { IInvoiceRepository, PersistedLine } from '../ports/IInvoiceRepository';
import type { IngestionMessage } from '../ports/IIngestionQueue';
import type { VisionParseService } from './VisionParseService';
import { decideStatus, isArithmeticConsistent, type InvoiceStatus, type ParsedLine } from '../domain/ingestion';

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
  ) {}

  async process(message: IngestionMessage): Promise<IngestionOutcome> {
    await this.tenantContext.setTenantId(message.tenantId);

    const claimed = await this.ledger.claim(message.s3Key, message.tenantId);
    if (!claimed) return { handled: false };

    const bytes = await this.fileStorage.getObjectBytes(message.s3Key);
    const receipt = await this.visionParser.parse(message.tenantId, { format: 'jpeg', bytes });

    const merchant = await this.merchantResolver.resolve(receipt.merchantRaw, LAUNCH_COUNTRY);
    const normalized = await this.productNormalizer.normalize(merchant.merchantId, receipt.lines);
    const categoryId = await this.classifier.classify({
      merchantId: merchant.merchantId,
      documentKindHint: receipt.documentKindHint,
      lines: receipt.lines,
      normalized,
    });
    const tags = await this.tagGenerator.generate({ merchantId: merchant.merchantId, categoryId, normalized });

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

    await this.ledger.setStatus(message.s3Key, 'DONE');
    return { handled: true, status };
  }
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
