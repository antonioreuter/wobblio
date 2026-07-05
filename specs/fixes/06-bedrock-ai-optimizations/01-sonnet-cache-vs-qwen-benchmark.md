# 06.01 — Sonnet 4.6 + prompt cache vs Qwen (vision cost benchmark)

**Type:** detached study (no production/CDK/quota change) · **Status:** built 2026-07-05

## Question

On the vision-parse stage, is **Claude Sonnet 4.6 with Bedrock prompt caching** cost-competitive with
**Qwen3-VL (no cache)** — and does it match/beat Qwen's accuracy, especially the `jumbo_2` multi-buy
quantity regression? If caching collapses Sonnet's ~4.5× per-token premium, swapping the primary vision
model becomes viable.

Why it must be measured, not modelled: the large static `VISION_PARSE_PROMPT` caches at 0.1×, but the
per-receipt **image tokens don't cache** — so the net outcome is genuinely uncertain.

## What was built (all detached / removable)

- **`CachingBedrockConverseAdapter`** (`src/infrastructure/adapters/ai/`) — `IBedrockConverse` that
  appends `system: [{text}, {cachePoint:{type:'default'}}]` and surfaces `cacheRead/WriteInputTokens`.
  Only cache-capable (Claude/Nova) tiers may use it. Wired only by the benchmark.
- **`bedrockContentBlocks.ts`** — `toContentBlocks`/`extractText` extracted from `BedrockConverseAdapter`
  and shared by both adapters (behaviour-preserving).
- **Port touch (additive, non-breaking):** optional `cacheReadInputTokens?` / `cacheWriteInputTokens?`
  on `BedrockConverseResult`.
- **`pull-benchmark-corpus.ts`** (`npm run corpus:pull`) — builds a gitignored corpus at
  `invoices/fixtures/benchmark-corpus/`: local `invoices/*` + ~100+ sampled from **`wobblio-uploads-dev`**
  (hard-refuses any `prod` bucket name; GDPR waived for this dev study).
- **`benchmark-vision-cost.ts`** (`npm run benchmark:vision-cost`) — runs both arms (Qwen/plain vs
  Sonnet-4.6/caching) over the corpus + curated `evaluation-set`, reusing the unchanged
  `VisionParseService` and the existing LLM judge on the 3 `.truth.json` fixtures.
- **Unit test** for `CachingBedrockConverseAdapter`.

## Cost model (benchmark-owned — `estimateCostUsd` can't price a model swap or cache)

Per receipt, per arm: `input×rate + output×rate + cacheRead×rate.input×0.1 + cacheWrite×rate.input×1.25`
(per 1k tokens; rates match `aiSpend.ts`: Qwen `{0.0008,0.0008}`, Sonnet `{0.003,0.015}`). The reported
**avg cost/receipt** naturally amortizes the one-time cache write across the batch — that is the
steady-state number answering "similar to Qwen?".

## How to run & read

```
cd Source/backend
AWS_PROFILE=<dev> AWS_REGION=eu-west-1 npm run corpus:pull -- --limit 100
npm run benchmark:vision-cost
```

Reads: the cost table's **avg cost/receipt** for B vs A (B≈A ⇒ Sonnet+cache is competitive); confirm
B's repeat calls show `cacheReadInputTokens > 0` (cache engaged); check the curated judge's
**extraction / line-item** scores (esp. `jumbo_2`). Classification/tag scores are not meaningful here
(downstream stages out of scope).

## Results (2026-07-05, 46 real dev receipts, real Bedrock via reuterAdmin)

| Metric | Qwen | Sonnet 4.6 + cache |
|---|---|---|
| Parsed / errors | 43 / 3 | 46 / 0 |
| Avg cost / receipt | $0.0047 | $0.0201 |
| Cost ratio | 1× | **4.27×** |
| Cache | — | 46/46 hits, 178,526 read tokens, 0 writes |

**Conclusion:** even with maximally-effective caching (every call a cache hit, prompt read at 0.1×),
Sonnet+cache is **~4.3× Qwen's cost** — caching does NOT make Sonnet cost-competitive. The gap is driven
by Sonnet's output-token rate (~19×) and image-input rate (~3.75×), which caching cannot reduce.

The 3 Qwen "errors" were all **PDFs** — Qwen3-VL rejects document blocks by design, which is why
production routes PDFs to the dedicated `pdf_parser` (Sonnet) tier, never Qwen. On the 43 **image**
receipts Qwen parsed 43/43, so it is not less robust on its actual primary-tier workload. (Side effect:
Qwen's avg cost is marginally understated by the 3 zero-cost PDF failures — the image-only comparison is
the fair one, and the ~4.3× ratio holds there.)

Accuracy favours Sonnet where it counts: it fixes `jumbo_2` (line-items 0.95 vs Qwen 0.70). This is a
quality-vs-4.3×-cost trade → argues for Sonnet as a **targeted fallback** on hard/low-confidence receipts
(the existing `EscalatingReceiptParser`) and as the **PDF tier**, NOT a primary swap. Prompt caching's
real value is on that Claude fallback/PDF tier (supported + worthwhile there). Qwen cannot use Bedrock
prompt caching, so no caching option exists for the primary tier.

## Non-functional

No DB migration, no CDK, no quota change, `validate:security` not required. Removal = delete the two
`src/local/` scripts + the caching adapter + revert the additive port fields.
