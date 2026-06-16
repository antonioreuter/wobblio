export type InvoiceStatus =
  | 'PROCESSING'
  | 'NEEDS_REVIEW'
  | 'PARSED'
  | 'FAILED_PROCESSING'
  | 'SUSPECTED_DUPLICATE'
  | 'DISCARDED';

export interface ParsedLine {
  rawText: string;
  quantity: number;
  lineTotal: number;
  unitPrice?: number;
  unitSizeRaw?: string;
}

export interface ParsedReceipt {
  merchantRaw: string;
  transactionDate: string; // ISO YYYY-MM-DD
  currency: string;
  total: number;
  documentKindHint?: string;
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
