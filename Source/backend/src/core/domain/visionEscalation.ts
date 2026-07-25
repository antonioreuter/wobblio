// Fix 11 — adaptive vision-model escalation (domain).
// Turns a primary (Qwen) parse into an escalation decision via a BLENDED quality score.
// Routing on the model's self-reported confidence alone is unsafe — Qwen reports 0.92 on
// wrong parses — so the score is the WEAKEST of three signals (min): a single collapsing
// signal (bad arithmetic, missing lines) governs regardless of the model's own confidence.
// Pure domain: no SDK, no SSM. Thresholds + model ids are injected (SSM, sub-spec 03).
import type { ModelRole } from '../ports/ai/IModelRegistry';

// Which tier the primary parse should be re-run on. NONE = keep the primary result.
export type EscalationTier = 'NONE' | 'FALLBACK' | 'FALLBACK_DEEP';

// Maps an escalating tier to the model-registry role whose SSM id the worker resolves.
export const ESCALATION_TIER_ROLE: Record<Exclude<EscalationTier, 'NONE'>, ModelRole> = {
  FALLBACK: 'vision_fallback',
  FALLBACK_DEEP: 'vision_fallback_deep',
};

// SSM-configured band cutoffs on the blended score (0..1). acceptMin > deepMax must hold.
export interface EscalationThresholds {
  acceptMin: number; // blended >= acceptMin → NONE
  deepMax: number; // blended < deepMax → FALLBACK_DEEP; in between → FALLBACK
  reconciliationTolerancePct: number; // residual at/above this scores 0 (e.g. 0.02 = 2%)
  // Layer C retake floor (fix 11): a parse is only asked to be RE-TAKEN when its reconciliation
  // residual is at/above this — a GROSS failure well beyond the correctable NEEDS_REVIEW zone, so
  // a receipt the arithmetic path would keep is never discarded (e.g. 0.15 = 15%; Estância was ~30%).
  retakeResidualPct: number;
}

// acceptMin (tuned 0.85→0.88 in the v9-vs-v10 sweep) sits just above the measured degraded-parse
// score (~0.85) and below clean parses (Qwen ~0.97), so a degraded parse falls under acceptMin and
// escalates. retakeResidualPct sits far above the 1% arithmetic-consistency tolerance so retake only
// fires on genuinely unreadable parses. Tunable live via SSM from production logs.
export const DEFAULT_ESCALATION_THRESHOLDS: EscalationThresholds = {
  acceptMin: 0.88,
  deepMax: 0.55,
  reconciliationTolerancePct: 0.02,
  retakeResidualPct: 0.15,
};

export interface QualityScoreInput {
  modelConfidence: number; // ParsedReceipt.parseConfidence (v10-calibrated)
  total: number; // receipt stated total
  lineSum: number; // Σ line totals
  parsedItemCount: number; // Σ line quantities (units) — comparable to the receipt's printed count
  statedItemCount?: number; // printed "QTD TOTAL DE ITENS", when the parse emits it (v10)
}

export interface QualityScore {
  blended: number;
  modelConfidence: number;
  reconciliationScore: number;
  coverageScore: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// Continuous reconciliation health: 1 when Σ lines matches the total, decaying to 0 as the
// residual reaches the configured tolerance. A non-positive total is a broken parse → 0.
function reconciliationScore(total: number, lineSum: number, tolerancePct: number): number {
  if (total <= 0 || tolerancePct <= 0) return 0;
  const residual = Math.abs(lineSum - total) / total;
  return clamp01(1 - residual / tolerancePct);
}

// Fraction of printed items (units) we captured, capped at 1. Unknown item count → 1 (neutral):
// never penalize on a signal the receipt didn't give us. Uses summed quantities, not line count,
// so multi-qty lines don't read as a shortfall; deposits/discounts only inflate it → conservative.
function coverageScore(parsedItemCount: number, statedItemCount: number | undefined): number {
  if (statedItemCount == null || statedItemCount <= 0) return 1;
  return clamp01(parsedItemCount / statedItemCount);
}

export function scoreParseQuality(input: QualityScoreInput, tolerancePct: number): QualityScore {
  const recon = reconciliationScore(input.total, input.lineSum, tolerancePct);
  const coverage = coverageScore(input.parsedItemCount, input.statedItemCount);
  const modelConfidence = clamp01(input.modelConfidence);
  return {
    blended: Math.min(modelConfidence, recon, coverage),
    modelConfidence,
    reconciliationScore: recon,
    coverageScore: coverage,
  };
}

// Bands are single-hop: the score picks the tier directly (no step-by-step cascade).
// Misconfiguration (deepMax >= acceptMin) fails open to NONE rather than escalating blindly.
export function decideEscalation(blended: number, thresholds: EscalationThresholds): EscalationTier {
  if (thresholds.deepMax >= thresholds.acceptMin) return 'NONE';
  if (blended >= thresholds.acceptMin) return 'NONE';
  if (blended < thresholds.deepMax) return 'FALLBACK_DEEP';
  return 'FALLBACK';
}
