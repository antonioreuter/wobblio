import type { InvoiceStatus, InvoiceVerdict } from '@core/domain/ingestion';
import type { FailureReasonCode, UnreadableReason } from '@core/domain/failureReasons';
import type { InvoiceLocationStatus, LocationSource } from '@core/domain/region';
import type { ObservationLine } from '@core/domain/priceObservation';

export interface CreatePendingInvoice {
  tenantId: string;
  uploadedByUserId: string;
  householdId: string | null;
  // The presign charge decision (§2.4): true when this upload draws the shared household
  // pool, false when it draws the uploader's personal counter. Persisted so the worker
  // charges the same counter presign authorized, immune to membership changes in-window.
  quotaPooled: boolean;
  imageS3Key: string;
  imageSha256: string;
  // Coarse upload geolocation (tier 2), reverse-geocoded at presign. Null when the
  // browser denied/lacked geolocation. Raw coordinates are never persisted.
  uploadCountryCode: string | null;
  uploadRegionCode: string | null;
}

export interface InvoiceRecord {
  id: string;
  tenantId: string;
  status: InvoiceStatus;
  imageS3Key: string;
  imageSha256: string;
  householdId: string | null;
  // Internal root cause, set only for a system-fault-quarantined invoice. Non-null is the
  // quarantine key: a blocked invoice cannot be deleted (§03.5). Never sent to the client.
  systemFaultReason: string | null;
  locationStatus: InvoiceLocationStatus;
  locationConfirmedAt: string | null;
  // The tier-2 upload-geo candidate the worker reads to decide the sharing location.
  uploadCountryCode: string | null;
  uploadRegionCode: string | null;
}

export interface PersistedLine {
  rawText: string;
  lineIndex: number; // 0-based position on the receipt, preserves discount↔product order
  productId: string | null;
  productProvisional: boolean;
  categoryId: string | null;
  quantity: number;
  packQuantity: number | null;
  baseUnit: 'KG' | 'L' | 'PIECE' | null;
  unitPrice: number | null;
  normalizedUnitPrice: number | null;
  lineTotal: number;
  isDiscount: boolean;
  isDepositOrFee: boolean;
  confidence: number;
}

export interface InvoiceLocation {
  countryCode: string | null;
  regionCode: string | null;
  status: InvoiceLocationStatus;
  source: LocationSource | null;
}

export interface PersistParsedInvoice {
  invoiceId: string;
  merchantId: string | null;
  merchantProvisional: boolean;
  transactionDate: string;
  currency: string;
  total: number;
  // The invoice total converted to the tenant's home currency at the transaction-date ECB rate
  // (§11 FX), plus the effective from→home rate preserved forever for historical honesty. Both
  // null when no rate was available (ingestion never fails on FX — reports fall back to `total`).
  totalHomeCurrency: number | null;
  fxRateUsed: number | null;
  categoryId: string | null;
  searchTags: string[];
  // Free-text receipt city for invoice search — never a vocabulary tag, never a price
  // observation field. Tenant-scoped, like region. Null when no city was printed.
  searchCity: string | null;
  status: InvoiceStatus;
  // True when this invoice must never reach the price index (e.g. an exact re-upload of
  // a previously-deleted invoice whose observations were already emitted, §6.5).
  priceEmissionBlocked: boolean;
  location: InvoiceLocation;
  lines: PersistedLine[];
}

export interface ConfirmLocationInput {
  invoiceId: string;
  countryCode: string;
  regionCode: string;
  status: InvoiceLocationStatus;
  source: LocationSource;
}

// Everything needed to rebuild de-identified observations for a held invoice at
// confirmation time, read back from the persisted invoice + invoice_line rows.
export interface InvoiceReEmission {
  merchantId: string | null;
  merchantProvisional: boolean;
  transactionDate: string;
  currency: string;
  lines: ObservationLine[];
  // A human corrected this invoice (16e) → its observations emit USER_CONFIRMED.
  userCorrected: boolean;
}

// A single line edit from the review screen (16e). Identified by its row id so the
// client can patch the exact line it rendered from getDetail.
export interface CorrectInvoiceLine {
  id: string;
  productId: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
}

// User corrections from the review screen: fixed header fields + per-line edits.
// Applying it flips the invoice to PARSED and stamps corrected_at.
export interface CorrectInvoiceInput {
  invoiceId: string;
  transactionDate: string | null;
  total: number | null;
  lines: CorrectInvoiceLine[];
}

export interface FuzzyFingerprint {
  merchantId: string | null;
  transactionDate: string;
  total: number;
  lineCount: number;
}

export interface InvoiceListItem {
  id: string;
  status: InvoiceStatus;
  merchantName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  transactionDate: string | null;
  total: number | null;
  currency: string | null;
  searchTags: string[];
  searchTagLabels: string[];
  searchCity: string | null;
  createdAt: string;
  locationStatus: InvoiceLocationStatus;
  locationCountryCode: string | null;
  locationRegionCode: string | null;
}

export interface InvoiceDetailLine {
  id: string;
  rawText: string;
  productId: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
  categoryName: string | null;
  // 0..1 parse confidence; the review screen ambers a low-confidence line (16e).
  confidence: number;
  // Structural flags (§11 splitting): discount / deposit-fee lines are never assignable — they
  // form the proportionally-allocated fee pool rather than a splittable item.
  isDiscount: boolean;
  isDepositOrFee: boolean;
}

export interface InvoiceDetail extends InvoiceListItem {
  imageS3Key: string;
  lines: InvoiceDetailLine[];
  // §11 FX header: the receipt total converted into the viewer's home currency at the frozen
  // transaction-date rate, the effective from→home rate that produced it, and the home-currency
  // code the converted figure is denominated in. All null when the invoice is already in the home
  // currency or no rate was available — the detail header then shows only the original amount.
  totalHomeCurrency: number | null;
  fxRateUsed: number | null;
  homeCurrency: string | null;
  // The tenant's accuracy verdict on this receipt, or null if never rated.
  feedbackVerdict: InvoiceVerdict | null;
  // Friendly failure reason for a FAILED_PROCESSING invoice (§03.4), powering the "why?"
  // surface. Null for any non-failed invoice. The internal root cause is never exposed.
  failureReasonCode: FailureReasonCode | null;
}

// Highest summed-spend merchant for the current calendar month.
export interface TopMerchant {
  name: string;
  total: number;
}

// The presign charge decision read back at success-time: which counter this upload draws.
// quotaPooled true → HOUSEHOLD_CREDITS keyed by householdId; false → CREDITS keyed by the
// uploader. The worker charges this, not a fresh membership resolve. createdAt (the presign
// week) lets the worker detect a cross-week operator reprocess (§07).
export interface InvoiceChargeTarget {
  quotaPooled: boolean;
  householdId: string | null;
  createdAt: string;
}

export interface IInvoiceRepository {
  createPending(input: CreatePendingInvoice): Promise<string>;
  // In-flight (PROCESSING) uploads this week for the quota owner — the uploader for a
  // personal counter, the household for the shared pool. Backs the presign burst
  // projection so concurrent uploads can't all clear the cap before any charge lands.
  countInFlightUploads(ownerId: string, isPool: boolean, weekStart: string): Promise<number>;
  getById(invoiceId: string): Promise<InvoiceRecord | null>;
  // The persisted presign charge decision for this invoice (quota_pooled + household_id),
  // read by the worker to charge the counter presign authorized. Null if the invoice is gone.
  findChargeTarget(invoiceId: string): Promise<InvoiceChargeTarget | null>;
  findSameTenantByHash(imageSha256: string): Promise<InvoiceRecord | null>;
  findFuzzyDuplicate(invoiceId: string, fingerprint: FuzzyFingerprint): Promise<boolean>;
  // True when another same-tenant invoice with this one's image hash already reached
  // a RESOLVED location (i.e. already emitted observations) — the exact re-upload guard.
  hasEmittedDuplicateByHash(invoiceId: string): Promise<boolean>;
  persistParsed(input: PersistParsedInvoice): Promise<void>;
  // Fail an invoice the model judged unreadable (§03.2): FAILED_PROCESSING + a user-fault
  // reason code, leaving system_fault_reason null so it stays deletable.
  markUnreadable(invoiceId: string, reason: UnreadableReason): Promise<void>;
  // Fail an invoice on a pre-AI user-fault reject (§06: oversize / too many pages /
  // unsupported format): FAILED_PROCESSING + reason code, no system_fault_reason — stays
  // deletable, never quarantined. Sibling of markUnreadable for non-model rejects.
  markFailed(invoiceId: string, reasonCode: FailureReasonCode): Promise<void>;
  // Quarantine an invoice after an our-stack crash (§03.5/§03.6): FAILED_PROCESSING +
  // SYSTEM_FAULT code + the internal root cause + blocked_at. Idempotent across SQS
  // redeliveries — returns true only on the transition into quarantine (0 rows → false),
  // so the caller fires the owner notification exactly once.
  quarantine(invoiceId: string, systemFaultReason: string): Promise<boolean>;
  // Write-once location confirmation; rebuild inputs for deferred emission.
  confirmLocation(input: ConfirmLocationInput): Promise<void>;
  getForReEmission(invoiceId: string): Promise<InvoiceReEmission | null>;
  // Flips a held invoice to RESOLVED after its region is mapped and re-emitted.
  markLocationResolved(invoiceId: string): Promise<void>;
  updateStatus(invoiceId: string, status: InvoiceStatus): Promise<void>;
  // Persist review-screen corrections: update header fields + the given lines, flip to
  // PARSED, and stamp corrected_at (so later emission marks observations USER_CONFIRMED).
  applyCorrection(input: CorrectInvoiceInput): Promise<void>;
  // Hides the invoice from the tenant's list by flipping its status to DISCARDED.
  softDelete(invoiceId: string): Promise<void>;
  listForTenant(limit: number): Promise<InvoiceListItem[]>;
  getDetail(invoiceId: string): Promise<InvoiceDetail | null>;
  // Top merchants by summed spend for the current month; returns up to limit results.
  getTopMerchantsThisMonth(limit: number): Promise<TopMerchant[]>;
}
