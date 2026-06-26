import { ConfidenceThresholds } from './ingestion';

// Whether an invoice's parse is trustworthy enough to contribute ANY price observation
// to the global, de-identified store (§6.5). A failing parse indicts the *whole* receipt
// and emits nothing — distinct from a provisional (new) product, which only quarantines
// its own line until catalog promotion. Integrity is about parse quality, not novelty.
export interface InvoiceIntegrityInput {
  parseConfidence: number;
  arithmeticOk: boolean;
  isSuspectedDuplicate: boolean;
}

export interface InvoiceIntegrity {
  integral: boolean;
  reasons: string[]; // failing checks, for emission-gate telemetry
}

export function assessInvoiceIntegrity(input: InvoiceIntegrityInput): InvoiceIntegrity {
  const reasons: string[] = [];
  if (input.parseConfidence < ConfidenceThresholds.visionMin) reasons.push('low_parse_confidence');
  if (!input.arithmeticOk) reasons.push('arithmetic_mismatch');
  if (input.isSuspectedDuplicate) reasons.push('suspected_duplicate');
  return { integral: reasons.length === 0, reasons };
}

export function isInvoiceIntegral(input: InvoiceIntegrityInput): boolean {
  return assessInvoiceIntegrity(input).integral;
}
