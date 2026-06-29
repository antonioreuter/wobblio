import type { FailureReasonCode, UnreadableReason } from './failureReasons';
import { OversizeUploadError, TooManyPagesError, UnsupportedUploadTypeError } from './errors';

export type InvoiceStatus =
  | 'PROCESSING'
  | 'NEEDS_REVIEW'
  | 'PARSED'
  | 'FAILED_PROCESSING'
  | 'SUSPECTED_DUPLICATE'
  | 'DISCARDED';

// The vision model's escape hatch (§ 03.2): instead of fabricating a receipt from a
// blurry/non-receipt image it returns this verdict. It is a model OUTPUT, never an
// exception — so it flows through the normal outcome path, is charged the tokens the
// model spent, and is a deletable user-fault (never quarantined).
export interface UnreadableVerdict {
  unreadable: true;
  reason: UnreadableReason;
}

export function isUnreadableVerdict(value: ParsedReceipt | UnreadableVerdict): value is UnreadableVerdict {
  return (value as UnreadableVerdict).unreadable === true;
}

// Only a successfully-parsed receipt is eligible for the §6.5 location gate. A
// duplicate must contribute zero observations (§6.8), and PROCESSING/FAILED/DISCARDED
// invoices have no shareable data — confirming a location for any of these must never
// emit (nor flip an in-flight invoice the worker is about to overwrite).
export function isLocationConfirmable(status: InvoiceStatus): boolean {
  return status === 'PARSED' || status === 'NEEDS_REVIEW';
}

// Canonical deletion-eligibility rule — the single source of truth for every delete path
// (user delete, future admin/GDPR purges). Two holds: PROCESSING is non-terminal, so
// deleting it would leave the worker writing to a discarded row and strand its
// content-addressed ledger claim; a system-fault-quarantined invoice (systemFaultReason
// set, §03.5) is held for operator reprocess and must not be farmed via delete+re-upload.
// Every other terminal status is deletable. `== null` also treats undefined as not-set.
export function isDeletable(status: InvoiceStatus, systemFaultReason: string | null): boolean {
  return status !== 'PROCESSING' && systemFaultReason == null;
}

// Pre-AI user-fault upload rejects (§06): detectable without a model call, they fail the
// invoice plain (FAILED_PROCESSING + reason code, deletable) — never quarantine, charge,
// or retry. Every OTHER thrown error is an our-stack fault → the quarantine path.
const USER_FAULT_UPLOAD_ERRORS = [
  OversizeUploadError,
  TooManyPagesError,
  UnsupportedUploadTypeError,
] as const;

export function isSystemFault(err: unknown): boolean {
  return !USER_FAULT_UPLOAD_ERRORS.some((type) => err instanceof type);
}

// The friendly reason code for a user-fault upload reject — drives the invoice "why?"
// surface (§03.4). Unsupported format vs everything-else (oversize / too many pages).
export function uploadFailureReasonCode(err: unknown): FailureReasonCode {
  if (err instanceof UnsupportedUploadTypeError) return 'UNSUPPORTED_FORMAT';
  return 'TOO_LARGE';
}

// User's accuracy rating on a parsed receipt (§ invoice_feedback). One verdict per
// invoice; re-rating overwrites the prior one.
export type InvoiceVerdict = 'UP' | 'DOWN';

export function isInvoiceVerdict(value: unknown): value is InvoiceVerdict {
  return value === 'UP' || value === 'DOWN';
}

export interface ParsedLine {
  rawText: string;
  quantity: number;
  lineTotal: number;
  unitPrice?: number;
  unitSizeRaw?: string;
}

// The store address as printed on the receipt — raw OCR only, never geo-inferred.
// Drives tier-1 location resolution (§6.5): only the printed address can auto-resolve
// an invoice's sharing region, because a franchise/brand spans countries.
export interface ParsedLocation {
  countryCode?: string; // ISO 3166-1 alpha-2, only when printed/unambiguous
  regionText?: string; // province/state as printed, raw (resolved to ISO 3166-2 downstream)
  city?: string;
  postalCode?: string;
}

export interface ParsedReceipt {
  merchantRaw: string;
  transactionDate: string; // ISO YYYY-MM-DD
  currency: string;
  total: number;
  documentKindHint?: string;
  location?: ParsedLocation;
  lines: ParsedLine[];
  parseConfidence: number; // 0..1
}

// Thresholds from spec 07 "Confidence Thresholds" + 08 §6.2/§6.3.
export const ConfidenceThresholds = {
  visionMin: 0.7,
  embeddingAccept: 0.92,
  embeddingLow: 0.85,
  fuzzyMatchMargin: 0.15,
  arithmeticAbsEur: 0.05,
  arithmeticPct: 0.01,
  // Floor for an admin product merge (source folds into target). Starts at the embedding
  // "low" band — below this the two products are too far apart to be the same item.
  mergeSimilarityMin: 0.85,
} as const;

// Σ line_totals reconciles with the receipt total within €0.05 or 1%.
export function isArithmeticConsistent(receipt: ParsedReceipt): boolean {
  const sum = receipt.lines.reduce((acc, line) => acc + line.lineTotal, 0);
  const delta = Math.abs(sum - receipt.total);
  return delta <= ConfidenceThresholds.arithmeticAbsEur
    || delta <= Math.abs(receipt.total) * ConfidenceThresholds.arithmeticPct;
}

export interface StatusDecisionInput {
  parseConfidence: number;
  arithmeticOk: boolean;
  hasLowConfidenceLine: boolean;
  lowConfidenceMerchant: boolean; // §6.2 resolved below threshold (e.g. provisional)
  isSuspectedDuplicate: boolean;
}

// Terminal status for a successfully-processed ingestion run.
export function decideStatus(input: StatusDecisionInput): InvoiceStatus {
  if (input.isSuspectedDuplicate) return 'SUSPECTED_DUPLICATE';
  if (
    input.parseConfidence < ConfidenceThresholds.visionMin
    || !input.arithmeticOk
    || input.hasLowConfidenceLine
    || input.lowConfidenceMerchant
  ) {
    return 'NEEDS_REVIEW';
  }
  return 'PARSED';
}
