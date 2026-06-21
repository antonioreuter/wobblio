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
import type { IRegionReference } from '../../ports/data-intelligence/IRegionReference';
import type { IngestionMessage } from '../../ports/ingestion/IIngestionQueue';
import type { VisionParseService } from './VisionParseService';
import { decideStatus, isArithmeticConsistent, type InvoiceStatus, type ParsedLine, type ParsedReceipt } from '../../domain/ingestion';
import { depositCategoryFor, discountCategoryFor } from '../../domain/categoryTaxonomy';
import { buildPriceObservations, type ContributorContext, type ObservationLine } from '../../domain/priceObservation';
import { resolveIngestionLocation, type LocationCandidate } from '../../domain/region';

const LAUNCH_COUNTRY = 'NL';

export interface IngestionOutcome {
  handled: boolean; // false => duplicate SQS delivery, skipped
  status?: InvoiceStatus;
  receipt?: ParsedReceipt; // the vision-parse result, for debug logging at the handler
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
    private readonly regionReference: IRegionReference,
  ) {}

  async process(message: IngestionMessage): Promise<IngestionOutcome> {
    await this.tenantContext.setTenantId(message.tenantId);

    const claimed = await this.ledger.claim(message.s3Key, message.tenantId);
    if (!claimed) return { handled: false };

    // Contributor country + today's date sharpen date/currency disambiguation in the
    // vision prompt; the same context resolves the sharing location below.
    const context = await this.contributorContext.getContext(message.tenantId);
    const processedDate = new Date().toISOString().slice(0, 10);

    const bytes = await this.fileStorage.getObjectBytes(message.s3Key);
    const receipt = await this.visionParser.parse(
      message.tenantId,
      { format: 'jpeg', bytes },
      { countryCode: context.countryCode, processedDate },
    );

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

    const fuzzyDuplicate = await this.invoiceRepo.findFuzzyDuplicate(message.invoiceId, {
      merchantId: merchant.merchantId,
      transactionDate: receipt.transactionDate,
      total: receipt.total,
      lineCount: receipt.lines.length,
    });
    // An exact re-upload of a receipt this tenant already contributed must not emit a
    // second, non-retractable observation set (§6.5). Presign rejects live same-hash
    // uploads, so this can only match a previously-DELETED invoice — there is nothing
    // for the user to compare against, so it stays a normal invoice (not flagged) and is
    // permanently kept out of the price index via priceEmissionBlocked.
    const alreadyContributed = await this.invoiceRepo.hasEmittedDuplicateByHash(message.invoiceId);
    // Only a live fuzzy twin (PARSED/NEEDS_REVIEW) is an actionable duplicate the user can resolve.
    const isSuspectedDuplicate = fuzzyDuplicate;
    const suppressEmission = fuzzyDuplicate || alreadyContributed;

    const status = decideStatus({
      parseConfidence: receipt.parseConfidence,
      arithmeticOk: isArithmeticConsistent(receipt),
      hasLowConfidenceLine: normalized.some(line => line.lowConfidence),
      lowConfidenceMerchant: merchant.provisional,
      isSuspectedDuplicate,
    });

    // Resolve the sharing location across the three tiers in one place (§6.5). Only a
    // printed receipt address with a mapped region auto-resolves; upload geolocation
    // and the profile are prefills held PENDING for the user to confirm via the gate.
    const location = await this.resolveLocation(message.invoiceId, receipt, context);
    await this.invoiceRepo.persistParsed({
      invoiceId: message.invoiceId,
      merchantId: merchant.merchantId,
      merchantProvisional: merchant.provisional,
      branchId: merchant.branchId,
      transactionDate: receipt.transactionDate,
      currency: receipt.currency,
      total: receipt.total,
      categoryId,
      searchTags: tags,
      // The receipt city is a free-text, tenant-scoped search field — kept out of the
      // controlled tag vocabulary and out of the price observation store (§6.5).
      searchCity: receipt.location?.city ?? null,
      status,
      priceEmissionBlocked: suppressEmission,
      location: {
        countryCode: location.countryCode,
        regionCode: location.regionCode,
        status: location.status,
        source: location.source,
      },
      lines: receipt.lines.map((line, index) => toPersistedLine(line, normalized[index], index)),
    });

    // A duplicate (fuzzy fingerprint or exact re-upload of a deleted invoice) stays out
    // of the price index: confirmed duplicates contribute no observations (§6.8) and
    // emitted rows are de-identified and cannot be retracted. The reserved quota slot is
    // kept — the scan still cost an AI parse, so it counts against the §2.4 cap (Epic 09).
    if (!suppressEmission && location.status === 'RESOLVED') {
      await this.emitPriceObservations(merchant, receipt, normalized, context, location);
    }

    await this.ledger.setStatus(message.s3Key, 'DONE');
    return { handled: true, status, receipt };
  }

  // Decide the invoice's sharing location across all three tiers (§6.5). The receipt
  // address is mapped to reference codes; the upload-geo prefill is read from the row
  // (reverse-geocoded at presign); the profile is the final fallback.
  private async resolveLocation(invoiceId: string, receipt: ParsedReceipt, context: ContributorContext) {
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

  // Stage 5 (§6.5): emit de-identified price observations into the RLS-exempt store.
  // The domain builder skips opt-out, missing-merchant, and non-priceable lines, and
  // quarantines provisional catalog entries. Only a RESOLVED location reaches here, so
  // its country/region (receipt-derived) override the contributor profile — the printed
  // address, not where the contributor lives, anchors the observation.
  private async emitPriceObservations(
    merchant: MerchantResolution,
    receipt: ParsedReceipt,
    normalized: NormalizedLine[],
    context: ContributorContext,
    location: LocationCandidate,
  ): Promise<void> {
    const rows = buildPriceObservations({
      merchantId: merchant.merchantId,
      merchantProvisional: merchant.provisional,
      transactionDate: receipt.transactionDate,
      currency: receipt.currency,
      lines: receipt.lines.map((line, index) => toObservationLine(line, normalized[index])),
      context: {
        optedOut: context.optedOut,
        regionCode: location.regionCode,
        countryCode: location.countryCode,
        trustScore: context.trustScore,
      },
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

function toPersistedLine(line: ParsedLine, norm: NormalizedLine, index: number): PersistedLine {
  const isDiscount = line.lineTotal < 0;
  return {
    rawText: line.rawText,
    lineIndex: index,
    productId: norm.productId,
    productProvisional: norm.productProvisional,
    categoryId: resolveLineCategory(norm, isDiscount),
    quantity: line.quantity,
    packQuantity: norm.packQuantity,
    baseUnit: norm.baseUnit,
    unitPrice: line.unitPrice ?? null,
    normalizedUnitPrice: norm.normalizedUnitPrice,
    lineTotal: line.lineTotal,
    isDiscount,
    isDepositOrFee: norm.isDepositOrFee,
    confidence: norm.confidence,
  };
}

// Deposits and discounts are structural — a negative total or a deposit flag is a far
// more reliable signal than the LLM's per-line category, so override it deterministically
// to the matching per-macro bucket (keeps the LLM's macro, just fixes the leaf).
function resolveLineCategory(norm: NormalizedLine, isDiscount: boolean): string | null {
  if (norm.isDepositOrFee) return depositCategoryFor(norm.categoryId);
  if (isDiscount) return discountCategoryFor(norm.categoryId);
  return norm.categoryId;
}
