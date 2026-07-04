import {
  ConfidenceThresholds,
  isArithmeticConsistent,
  isUnreadableVerdict,
  type ParsedReceipt,
  type UnreadableVerdict,
} from './ingestion';

// Why a primary vision parse is re-run on the powerful fallback model. Recorded for telemetry.
export type EscalationReason = 'BLURRY' | 'LOW_CONFIDENCE' | 'ARITHMETIC' | 'SUSPECT_MULTIBUY';

export interface EscalationDecision {
  escalate: boolean;
  reason?: EscalationReason;
}

const NO_ESCALATION: EscalationDecision = { escalate: false };

// A fabricated per-unit price betrays the vision model splitting a line_total by an invented
// quantity (e.g. qty 2 @ 0.625 from a 1.25 total): real receipt prices are whole cents, so a
// unit_price with sub-cent precision on a multi-unit line is the tell. A genuine "2 x 1.99"
// multi-buy passes (1.99 is whole-cent). Low false-positive by construction.
function hasFabricatedMultiBuy(receipt: ParsedReceipt): boolean {
  return receipt.lines.some(
    (line) =>
      line.quantity > 1 &&
      line.unitPrice !== undefined &&
      Math.abs(line.unitPrice * 100 - Math.round(line.unitPrice * 100)) > 1e-6,
  );
}

// Decide whether the primary parse is unreliable enough to re-run on the powerful fallback model.
// Pure — runs on the post-processed parse (VisionParseService already dropped non-item/continuation
// lines), so the arithmetic and multi-buy checks see clean data.
export function shouldEscalate(parsed: ParsedReceipt | UnreadableVerdict): EscalationDecision {
  // A powerful model may still read a blurry image; a not-a-receipt genuinely is not one.
  if (isUnreadableVerdict(parsed)) {
    return parsed.reason === 'BLURRY' ? { escalate: true, reason: 'BLURRY' } : NO_ESCALATION;
  }
  if (!isArithmeticConsistent(parsed)) return { escalate: true, reason: 'ARITHMETIC' };
  if (parsed.parseConfidence < ConfidenceThresholds.escalationConfidenceMin) {
    return { escalate: true, reason: 'LOW_CONFIDENCE' };
  }
  if (hasFabricatedMultiBuy(parsed)) return { escalate: true, reason: 'SUSPECT_MULTIBUY' };
  return NO_ESCALATION;
}
