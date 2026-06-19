export type InvoiceStatus =
  | 'PROCESSING'
  | 'NEEDS_REVIEW'
  | 'PARSED'
  | 'FAILED_PROCESSING'
  | 'SUSPECTED_DUPLICATE'
  | 'DISCARDED';

// Only a successfully-parsed receipt is eligible for the §6.5 location gate. A
// duplicate must contribute zero observations (§6.8), and PROCESSING/FAILED/DISCARDED
// invoices have no shareable data — confirming a location for any of these must never
// emit (nor flip an in-flight invoice the worker is about to overwrite).
export function isLocationConfirmable(status: InvoiceStatus): boolean {
  return status === 'PARSED' || status === 'NEEDS_REVIEW';
}

// PROCESSING is the only non-terminal status; deleting an in-flight invoice would
// leave the worker writing to a discarded row and strand its content-addressed ledger
// claim. Every terminal status (incl. FAILED_PROCESSING/SUSPECTED_DUPLICATE) is deletable.
export function isDeletable(status: InvoiceStatus): boolean {
  return status !== 'PROCESSING';
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
