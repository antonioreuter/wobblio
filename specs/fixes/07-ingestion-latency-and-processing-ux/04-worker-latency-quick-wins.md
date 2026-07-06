# 07.04 — Worker latency quick wins

**Goal:** cut 2.5–4s off real p50 without touching model choice or pipeline semantics. Every item
is behaviour-preserving; verify with the same Logs Insights queries as the 00-handoff baseline.

## 1. Parallelize embeddings inside ProductNormalizer (~0.8s avg)

`ProductNormalizer.resolveProduct` currently interleaves ~8 serial 124ms Bedrock embedding calls
with pg lookups. The "sequential, not Promise.all" comment protects the **shared pg connection**,
not Bedrock. Restructure:

- Phase A (parallel, Bedrock only): `Promise.all` over `embedder.embed(item.displayName)` for all
  unmatched items (bounded concurrency ~8 to be polite to Bedrock quotas).
- Phase B (serial, pg only): existing `searchByEmbedding` / `writeAlias` / `createProvisional`
  loop unchanged, consuming the pre-computed embeddings.

Metering (`MeteringBedrockEmbedder`) must stay accurate under concurrency — `TokenMeter` additions
are synchronous, fine, but add a unit test asserting totals under parallel calls.

## 2. Parallelize expansion chunks (up to ~3.8s on >20-line receipts)

`expandBatched` runs `EXPANSION_BATCH=20` chunks serially; each chunk is an independent Bedrock
call with positional output. Run chunks with `Promise.all` (they share no pg state; positional
alignment is preserved by indexing results per chunk, not by arrival order). Retry-with-errors
stays per-chunk. Most receipts (<20 unmatched lines) are unaffected; long receipts stop paying
3.8s per extra chunk.

## 3. Hoist worker init out of the per-invocation path (~0.3–0.5s/invocation)

`agentic-worker/index.ts` rebuilds the pool and awaits **five sequential SSM reads** (vision, pdf,
auxiliary, embedder, vision_fallback) on *every* invocation. Move pool + model-id resolution to
module scope behind a memoized async init (standard Lambda warm-container pattern), with a TTL
(~5 min) so live model swaps via SSM still take effect — the admin model-swap matrix depends on
that, do not cache forever. Parallelize the five reads with `Promise.all` for the cold path.

## 4. Restructure the product-expansion prompt for cacheability (~0.2–0.4s + cost)

`buildExpansionMessage` rebuilds the full category taxonomy + tag vocabulary (~static, large) into
the **user** message on every call; measured input is ~3.8k tokens. Move the static
taxonomy/vocabulary block into the system prompt (bump `PRODUCT_EXPANSION_PROMPT_VERSION`), leaving
only `<lines>` in the user message. Then, since auxiliary is Haiku-class (cache-capable, and the
static block clears the 1k-token checkpoint minimum — the 06-handoff deferred exactly this),
compose the existing `CachingBedrockConverseAdapter` from the 06.01 branch onto the auxiliary tier
in the worker. Keep it **detached and removable** per the decisions of record: wired by
composition in the handler, one-line revert. Fold `cacheRead/Write` tokens into metering the
quota-stable way the 06-handoff prescribes (cached tokens count into `inputTokens` so
`TokenMeter.total` and charging are unchanged).

Prereq: the 06.01 branch (`feature/vision-cost-cache-benchmark`) must be merged or the adapter
cherry-picked; do not re-implement it.

## Explicit non-goals

- Vision-stage latency (10.3s, 60% of wall time): decode-bound on Qwen3-VL-235B; the output schema
  is already near-minimal (verbatim `raw_text` is required downstream). Only a model change moves
  it → 07.05, gated.
- Queue wait (1.3s), SQS batching, Lambda memory tuning: not worth the risk/benefit at n=current.
- Merchant/product stage overlap: product normalization consumes `merchant.merchantId` for alias
  scoping — restructuring that coupling for ~0.6s fails the Rule-of-Three complexity test.

## Acceptance

- Unit: normalizer parallel-embedding order preservation + meter accuracy; chunk-parallel expansion
  positional alignment (shuffled resolution order in the mock); memoized init respects TTL.
- Prompt change: `prompt_version` bumped; schema validator unchanged; run the 06.01 benchmark
  harness's curated judge (or the existing extraction fixtures) to confirm expansion quality did
  not drift.
- Measure: after a week on dev, re-run the baseline Logs Insights queries; expect
  PRODUCT_NORMALIZATION avg ≤ 3s and end-to-end p50 ≤ 14s. Record actuals in the 00-handoff.
- Gates: hexagonal validator exit 0 · `test:unit` · no DDL (no security validator run needed) ·
  worker telemetry events (`agentic_stage`, `bedrock_usage`, `ingestion timing`) unchanged in
  shape — the KPI rollup cron depends on them.
