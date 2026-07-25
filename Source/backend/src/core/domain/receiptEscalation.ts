import { isArithmeticConsistent, isUnreadableVerdict, type ParsedReceipt, type UnreadableVerdict } from './ingestion';
import {
  scoreParseQuality,
  decideEscalation,
  type EscalationTier,
  type EscalationThresholds,
  type QualityScore,
} from './visionEscalation';

// Why a primary vision parse escalated — recorded for the monitoring log (fix 11 decision 2).
export type EscalationReason = 'BLURRY' | 'LOW_CONFIDENCE' | 'ARITHMETIC' | 'COVERAGE' | 'SUSPECT_MULTIBUY';

export interface ReceiptEscalationDecision {
  tier: EscalationTier; // NONE | FALLBACK (mid/Sonnet) | FALLBACK_DEEP (Opus)
  reason?: EscalationReason; // dominant signal, telemetry only
  score?: QualityScore; // the blended breakdown, telemetry only (absent for unreadable verdicts)
}

const NONE: ReceiptEscalationDecision = { tier: 'NONE' };

// A fabricated per-unit price betrays the vision model splitting a line_total by an invented
// quantity (e.g. qty 2 @ 0.625 from a 1.25 total): real receipt prices are whole cents, so a
// unit_price with sub-cent precision on a multi-unit line is the tell. A genuine "2 x 1.99"
// multi-buy passes (1.99 is whole-cent). Low false-positive by construction — a targeted signal
// the blended score can miss (a fabricated line can still reconcile), so it floors escalation.
function hasFabricatedMultiBuy(receipt: ParsedReceipt): boolean {
  return receipt.lines.some(
    (line) =>
      line.quantity > 1 &&
      line.unitPrice !== undefined &&
      Math.abs(line.unitPrice * 100 - Math.round(line.unitPrice * 100)) > 1e-6,
  );
}

// The signal that dragged the blended score down (blended = min of the three) — labels the log.
function dominantReason(score: QualityScore): EscalationReason {
  if (score.reconciliationScore === score.blended) return 'ARITHMETIC';
  if (score.coverageScore === score.blended) return 'COVERAGE';
  return 'LOW_CONFIDENCE';
}

// Decide whether — and how deep — to re-run the primary parse on a stronger model. Pure; runs on
// the post-processed parse (VisionParseService already dropped non-item/continuation lines).
export function decideReceiptEscalation(
  parsed: ParsedReceipt | UnreadableVerdict,
  thresholds: EscalationThresholds,
): ReceiptEscalationDecision {
  // A stronger model may still read a blurry image; a not-a-receipt genuinely is not one.
  if (isUnreadableVerdict(parsed)) {
    return parsed.reason === 'BLURRY' ? { tier: 'FALLBACK', reason: 'BLURRY' } : NONE;
  }

  const score = scoreParseQuality(
    {
      modelConfidence: parsed.parseConfidence,
      total: parsed.total,
      lineSum: parsed.lines.reduce((sum, line) => sum + line.lineTotal, 0),
      parsedItemCount: parsed.lines.reduce((sum, line) => sum + line.quantity, 0),
      statedItemCount: parsed.statedItemCount,
    },
    thresholds.reconciliationTolerancePct,
  );

  const tier = decideEscalation(score.blended, thresholds);
  if (tier !== 'NONE') return { tier, reason: dominantReason(score), score };
  if (hasFabricatedMultiBuy(parsed)) return { tier: 'FALLBACK', reason: 'SUSPECT_MULTIBUY', score };
  return { tier: 'NONE', score };
}

// Fix 11 Layer C: after escalation has already run, is the FINAL photo parse GROSSLY broken —
// unreadable, not merely imperfect — so the honest answer is "retake" rather than "review"?
//
// Reserved for genuine failure only. It must NEVER discard a receipt the pipeline would otherwise
// keep: a parse that reconciles within the arithmetic-consistency tolerance (≤1% / €0.05) is
// PARSED-worthy, and a residual in the correctable band (1%..retakeResidualPct) still flows to
// NEEDS_REVIEW where the user fixes the offending line. Only a residual at/above retakeResidualPct
// (a gross reconciliation failure — the Estância case, Σ ~30% off) trips retake. Model confidence
// and item-coverage are deliberately NOT triggers: a low-confidence-but-reconciling parse is
// reviewable, and a coverage shortfall on a reconciling parse (e.g. a mis-read stated_item_count)
// is not a reason to throw away correct line data. Pure; the caller gates this to photo receipts
// in escalation-enabled deployments only.
export function isRetakeSuggested(receipt: ParsedReceipt, thresholds: EscalationThresholds): boolean {
  if (isArithmeticConsistent(receipt)) return false; // reconciles → keep (PARSED/NEEDS_REVIEW)
  if (receipt.total <= 0) return true; // no usable total survived the parse → unreadable
  const lineSum = receipt.lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const residual = Math.abs(lineSum - receipt.total) / receipt.total;
  return residual >= thresholds.retakeResidualPct;
}
