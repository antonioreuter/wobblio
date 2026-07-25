# 02 — Blended quality score & escalation decision (domain)

Pure domain logic that turns a primary (Qwen) parse into an escalation decision. No SDK, no SSM, no infra — 100% mock-free unit-testable. Consumed by the worker (sub-spec 04); thresholds/model ids injected from SSM (sub-spec 03).

## Why blended, not raw model confidence

Qwen self-reports **0.92 on a wrong parse** (Estância, 3 runs). Routing on the model's own number would never escalate the failures we care about. So the routing score is the **weakest of three signals** — `min(modelConfidence, reconciliationScore, coverageScore)` — so any one collapsing signal (bad arithmetic, missing lines) drags the score down regardless of how confident the model claims to be. `min` is deliberate over a weighted average: an average lets a high self-confidence mask a reconciliation failure, which is exactly the bug.

## Signals

- **modelConfidence** — `ParsedReceipt.parseConfidence` (prompt v10 makes this calibrated; sub-spec 01). Used as-is.
- **reconciliationScore** — from `residual = |Σ lineTotals − total| / max(|total|, EPS)`; `score = clamp(1 − residual / tolPct, 0, 1)`. Reuses the §-reconcile idea as a *continuous* score (the boolean `isArithmeticConsistent` stays for status). `tolPct` is configurable (default 0.02).
- **coverageScore** — `min(parsedLineCount / statedItemCount, 1)` when the receipt prints an item count (`statedItemCount`, emitted by v10 from "QTD TOTAL DE ITENS"). Absent → `1` (neutral; never penalize a signal we don't have). A lower-bound proxy (lines vs items ignores multi-qty lines) — documented, refined by telemetry.

## Decision

```
blended = min(modelConfidence, reconciliationScore, coverageScore)
blended ≥ acceptMin           → NONE            (keep primary)
deepMax ≤ blended < acceptMin  → FALLBACK        (vision_fallback,      Sonnet)
blended < deepMax             → FALLBACK_DEEP   (vision_fallback_deep, Opus)
```

Single hop — the band picks the tier; no step-by-step cascade. `acceptMin > deepMax` is validated (invalid config → treated as accept-all, fail-open, logged by caller).

## Surface (`src/core/domain/visionEscalation.ts`)

```ts
export type EscalationTier = 'NONE' | 'FALLBACK' | 'FALLBACK_DEEP';
export const ESCALATION_TIER_ROLE: Record<'FALLBACK' | 'FALLBACK_DEEP', ModelRole>;
export interface EscalationThresholds { acceptMin: number; deepMax: number; reconciliationTolerancePct: number; }
export const DEFAULT_ESCALATION_THRESHOLDS: EscalationThresholds; // 0.85 / 0.55 / 0.02
export interface QualityScoreInput { modelConfidence; total; lineSum; parsedLineCount; statedItemCount?; }
export interface QualityScore { blended; modelConfidence; reconciliationScore; coverageScore; }
export function scoreParseQuality(input, tolPct): QualityScore;
export function decideEscalation(blended, thresholds): EscalationTier;
```

The `QualityScore` breakdown is returned whole so the worker can log every sub-score (decision 2 — escalation monitoring).

## Tests (`tests/unit/core/domain/visionEscalation.test.ts`)

- Qwen-overconfidence case: `modelConfidence 0.92`, `lineSum 899 / total 847` → reconciliationScore ≈ 0 → blended ≈ 0 → `FALLBACK_DEEP`. (The regression this whole family exists for.)
- Clean parse: high conf, Σ matches, full coverage → `NONE`.
- Mid band: reconciliation slightly off → blended in `[deepMax, acceptMin)` → `FALLBACK`.
- Coverage absent (`statedItemCount` undefined) → coverage neutral, not penalized.
- Boundary: `blended === acceptMin` → NONE; `blended === deepMax` → FALLBACK.
- Zero/negative total → reconciliationScore 0.
- Invalid thresholds (`deepMax ≥ acceptMin`) → documented fail-open.
