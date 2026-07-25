# 01 — Vision prompt v10: calibrated confidence + printed item count

Sharpens two of the three escalation signals (sub-spec 02). `parse_confidence` today is uncalibrated — Qwen returns 0.92 on a wrong parse — and the coverage signal has no data source. v10 gives the model a confidence rubric and makes it transcribe the receipt's printed item count.

## Changes

**Both prompt bases** (`prompts/visionParseByCountry/compose.ts` — production images; `prompts/visionParse.ts` — PDFs/eval control):
1. **Confidence rubric** replaces the one-line "parse_confidence is your own 0..1 confidence". Anchored: start at 1.0; lower for folds/tears/fade, for every guessed line/price, for a non-reconciling Σ, and for a stated-count mismatch. Bands: 0.9–1.0 only when crisp + reconciled + count matches; 0.6–0.85 when several lines uncertain; <0.5 when large portions are guessed. "Reporting high confidence on a shaky extraction is a serious error."
2. **`<item_count>`** block: transcribe the printed total-item count (`AANTAL ARTIKELEN`, `QTD TOTAL DE ITENS`, `ITEMS n`, `N. ITENS`) into top-level `stated_item_count`; never emit it as a line; use it as a checksum before finalizing. It stays in the exclusion list (not a purchased line).
3. **`stated_item_count`** added to `<schema>` (optional integer).
4. Version bumps: `VISION_PARSE_BASE_VERSION → vision-parse/v10c`, `VISION_PARSE_PROMPT_VERSION → vision-parse/v10`.

**Schema parser** (`core/domain/receiptSchema.ts`): accept optional `stated_item_count` (finite integer ≥ 0; `null`/absent → omit) → `ParsedReceipt.statedItemCount`.

**Coverage signal fix** (`core/domain/visionEscalation.ts`): coverage compares the printed count against **summed line quantities** (`parsedItemCount = Σ quantity`), not line count — receipts count scanned units, and multi-qty lines would otherwise trip a false shortfall. Still capped at 1 and neutral (1) when no count is printed, so it only ever penalizes a genuine unit shortfall (conservative: deposits/discounts inflate the sum, biasing coverage up).

## Validation (measure, don't assume — decision 3)

Extend `src/local/compare-vision-models.ts` to print `parse_confidence` + `stated_item_count`, run Qwen v9-vs-v10 on the Estância image and the eval fixtures, and check: (a) v10 confidence drops on the degraded receipt (currently a stuck 0.92); (b) `stated_item_count` is populated (69 for Estância); (c) clean fixtures keep high confidence (no calibration regression that would over-escalate). A better *number* only counts if it is better *calibrated*.

## Status

Implemented 2026-07-15 (prompt + parser + coverage; both bases → v10/v10c; schema parser; coverage on Σqty). `tsc` 0 · hexagonal clean · 1035 unit tests green.

### Full sweep (2026-07-17) — v10 KEPT, rubric works on the production path
A/B on `composeCountryVisionPrompt` (the image path), Qwen, v9c-rubric vs v10c-rubric (same country pack — only the rubric text differs):

| Fixture | v9c conf | v10c conf | correct |
|---|---|---|---|
| ah_1 / jumbo_1 / jumbo_2 (clean) | 0.97 | 0.97–0.98 | ✓ |
| estancia (degraded) | 0.92 (×2) | **0.85 (×2)** | ✗ |

- **Calibration improved:** correct−wrong confidence gap ≈ **0.05 (v9) → ~0.12 (v10)**. v10 holds clean receipts high and drops the degraded one, consistently and reproducibly.
- **No accuracy regression** (100% both arms) and **no over-escalation** (clean receipts unchanged at ~0.97).
- **`stated_item_count` emits 8/8** with v10 (0/8 v9); values are plausible independent reads.
- **Threshold tuned:** `DEFAULT_ESCALATION_THRESHOLDS.acceptMin` 0.85 → **0.88** — 0.85 exactly equalled the degraded-receipt confidence (would never trigger); 0.88 sits in the measured 0.85↔0.97 gap so v10's confidence becomes a real secondary trigger. Tunable via SSM.

Correction to the 2026-07-15 note: that "inert" reading tested the `visionParse.ts` monolith (the PDF-only path), not the image path — measuring the correct path reversed it. Reconciliation is still the strongest signal, but confidence now contributes.
