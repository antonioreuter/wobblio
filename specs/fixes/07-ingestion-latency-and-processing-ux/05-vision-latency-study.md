# 07.05 — Vision latency study (detached, decision-gated)

**Status: GATED.** Do not start without an explicit user go — the 06-handoff records two standing
decisions this touches: *keep Qwen as primary* and *Nova eval deferred*. This sub-spec exists
because the latency data adds a dimension those decisions didn't weigh.

## Why revisit at all

- VISION_PARSE is **10.3s avg / 15.6s p90 — 60% of end-to-end wall time**. After 07.04, it is the
  only remaining lever; no code-level fix moves it (output is decode-bound at ~514 tokens of
  near-minimal schema).
- The n=3 fallback datapoint (Sonnet 4.6: 4.9s for the same parse) proves a ~2× latency gap
  between models on identical work. 06.01 rejected Sonnet **on cost** (4.3×) — correctly — but
  never measured latency as an outcome, and never tested the *fast-and-cheap* candidates
  (e.g. smaller Qwen3-VL variants on Bedrock, Haiku 4.5 vision was accuracy-rejected in the
  2026-07-04 eval, Nova-class was deferred untested).

## Question

Is there a vision-capable model on Bedrock eu-west-1 that is **≥ Qwen3-VL-235B accuracy on the
curated evaluation set (incl. `jumbo_2` line-items), ≤ ~1.2× its cost, and materially faster
(target: p50 vision stage ≤ 5s)**? If yes, swapping `/wobblio/config/models/vision_parser` (an
SSM value — swappable live, no deploy) buys more latency than everything else in this epic
combined.

## What to build (all detached / removable, per the AI-experiments decision of record)

Extend the existing 06.01 harness (`benchmark-vision-cost.ts` + `pull-benchmark-corpus.ts` on
`feature/vision-cost-cache-benchmark`) — do not write a new one:

1. **Latency as a first-class metric:** record per-call wall time (the adapter already returns
   enough; add durations to the report table: avg / p50 / p90 per arm).
2. **Configurable arms:** arms defined as `{modelId, caching?}` list instead of the hardcoded
   Qwen/Sonnet pair, so candidate models are a config edit. Candidates to propose at gate time
   (verify availability in eu-west-1 first — Anthropic ids need the `eu.` inference-profile
   prefix): smaller Qwen3-VL variant(s) if Bedrock offers them, and whatever fast vision tier is
   current; include Qwen3-VL-235B as the control arm.
3. **Same corpus + judge:** the gitignored dev corpus (`corpus:pull`, dev bucket only — the script
   already hard-refuses prod) and the 3-fixture LLM judge for accuracy. PDFs excluded (separate
   `pdf_parser` tier, out of scope).

## Decision rule (bring back to the user, don't auto-apply)

Report a three-column table — accuracy (judge, esp. line-items), avg cost/receipt, latency
p50/p90 — with a recommendation. A swap only proceeds as its own production sub-spec (SSM value
change + burn-in comparison via `invoice_feedback.model_ids_snapshot`), mirroring how the
06-handoff scoped Sonnet productionization.

## Non-functional

No DB migration, no CDK, no quota change. Real Bedrock spend on dev (~50–100 receipts × arms) —
same order as the 06.01 run. Removal = revert the harness extension.
