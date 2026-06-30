import type { IIngestionLedger } from '../../ports/ingestion/IIngestionLedger';
import type { IInvoiceRepository, PersistedLine } from '../../ports/ingestion/IInvoiceRepository';
import type { IPriceObservationStore } from '../../ports/data-intelligence/IPriceObservationStore';
import type { MerchantResolution } from '../../ports/data-intelligence/IMerchantResolver';
import type { NormalizedLine } from '../../ports/data-intelligence/IProductNormalizer';
import type { IngestionMessage } from '../../ports/ingestion/IIngestionQueue';
import { decideStatus, isArithmeticConsistent, type ParsedLine, type ParsedReceipt } from '../../domain/ingestion';
import { assessInvoiceIntegrity } from '../../domain/invoiceGlobalEligibility';
import { depositCategoryFor, discountCategoryFor } from '../../domain/categoryTaxonomy';
import { buildPriceObservations, type ContributorContext, type ObservationLine } from '../../domain/priceObservation';
import type { ResolvedIngestionLocation } from '../../domain/region';
import type { IngestionOutcome } from './IngestionService';

// The canonicalized output of the extraction stages (vision parse → merchant → product →
// classify → tag), the single input both pipelines hand to the finalizer. Keeping this
// shared guarantees LEGACY and STRANDS behave identically downstream (the A/B premise).
export interface ExtractionResult {
  receipt: ParsedReceipt;
  location: ResolvedIngestionLocation;
  merchant: MerchantResolution;
  normalized: NormalizedLine[];
  categoryId: string | null;
  tags: string[];
}

export interface FinalizeInput extends ExtractionResult {
  message: IngestionMessage;
  context: ContributorContext;
}

// Result of the extraction phase (shared front + canonicalization), before finalization.
// Both pipelines expose `extract()` returning this so the evaluation harness (07) can grade
// the canonicalized output in dry-run, without persisting an invoice or emitting observations.
export type ExtractOutcome =
  | { kind: 'duplicate' }
  | { kind: 'unreadable'; outcome: IngestionOutcome }
  | { kind: 'ready'; extraction: ExtractionResult; context: ContributorContext };

// Stage 6 of §6: duplicate/integrity gates, status decision, tenant persistence, de-identified
// price emission, and ledger completion. Extracted from IngestionService so the legacy and
// agentic workers share one downstream path. Runs inside the caller's open tenant transaction.
export class InvoiceFinalizer {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly priceObservationStore: IPriceObservationStore,
    private readonly ledger: IIngestionLedger,
  ) {}

  async finalize(input: FinalizeInput): Promise<IngestionOutcome> {
    const { message, receipt, location, context, merchant, normalized, categoryId, tags } = input;

    const fuzzyDuplicate = await this.invoiceRepo.findFuzzyDuplicate(message.invoiceId, {
      merchantId: merchant.merchantId,
      transactionDate: receipt.transactionDate,
      total: receipt.total,
      lineCount: receipt.lines.length,
    });
    // An exact re-upload of a receipt this tenant already contributed must not emit a second,
    // non-retractable observation set (§6.5). Presign rejects live same-hash uploads, so this
    // can only match a previously-DELETED invoice — kept permanently out of the index.
    const alreadyContributed = await this.invoiceRepo.hasEmittedDuplicateByHash(message.invoiceId);
    const isSuspectedDuplicate = fuzzyDuplicate;
    const arithmeticOk = isArithmeticConsistent(receipt);

    // A non-integral parse (bad arithmetic / low confidence / suspected duplicate) indicts the
    // whole receipt and contributes nothing to the global store (§6.5). A provisional product is
    // NOT an integrity fail — it emits born-quarantined per line.
    const integrity = assessInvoiceIntegrity({
      parseConfidence: receipt.parseConfidence,
      arithmeticOk,
      isSuspectedDuplicate,
    });
    const suppressEmission = fuzzyDuplicate || alreadyContributed || !integrity.integral;

    const status = decideStatus({
      parseConfidence: receipt.parseConfidence,
      arithmeticOk,
      hasLowConfidenceLine: normalized.some((line) => line.lowConfidence),
      lowConfidenceMerchant: merchant.provisional,
      isSuspectedDuplicate,
    });

    await this.invoiceRepo.persistParsed({
      invoiceId: message.invoiceId,
      merchantId: merchant.merchantId,
      merchantProvisional: merchant.provisional,
      transactionDate: receipt.transactionDate,
      currency: receipt.currency,
      total: receipt.total,
      categoryId,
      searchTags: tags,
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

    if (!suppressEmission && location.status === 'RESOLVED') {
      await this.emitPriceObservations(merchant, receipt, normalized, context, location);
    }

    await this.ledger.setStatus(message.s3Key, 'DONE');
    return {
      handled: true,
      status,
      receipt,
      emissionGate: { suppressed: suppressEmission, integral: integrity.integral, reasons: integrity.reasons },
    };
  }

  private async emitPriceObservations(
    merchant: MerchantResolution,
    receipt: ParsedReceipt,
    normalized: NormalizedLine[],
    context: ContributorContext,
    location: ResolvedIngestionLocation,
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

// Deposits and discounts are structural — a negative total or a deposit flag is a far more
// reliable signal than the LLM's per-line category, so override it deterministically to the
// matching per-macro bucket (keeps the LLM's macro, just fixes the leaf).
function resolveLineCategory(norm: NormalizedLine, isDiscount: boolean): string | null {
  if (norm.isDepositOrFee) return depositCategoryFor(norm.categoryId);
  if (isDiscount) return discountCategoryFor(norm.categoryId);
  return norm.categoryId;
}
