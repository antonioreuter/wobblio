# 06 — Bedrock AI Optimizations (living handoff)

Follow-ups from the 2026 AWS AI review of the agentic ingestion pipeline. Each sub-spec is
independent; implement one at a time and update this tracker.

| Sub-spec | Status | Notes |
|---|---|---|
| 01 — Sonnet 4.6 + prompt-cache vs Qwen (vision cost benchmark) | ✅ Built (study, detached) | 2026-07-05 |
| 02 — Amazon Nova eval candidate | ⬜ Deferred | User: keep Qwen; not benchmarking Nova now |
| 03 — Bedrock Data Automation bake-off | ⬜ Not started | Separate study, compare vs existing extraction |

## Key findings driving this epic

- **Qwen3-VL cannot use Bedrock prompt caching** — only Claude/Nova do (AWS docs, June 2026). A
  `cachePoint` block sent to Qwen raises `ValidationException`. So caching only ever helps
  Claude-backed tiers.
- **Sonnet 4.6 ≥ Qwen on accuracy** (fixes `jumbo_2`) at ~4.5× per-token cost. Prompt caching (the
  large static `VISION_PARSE_PROMPT` cached at 0.1×) may collapse that multiple — hence sub-spec 01.

## Decisions of record

- New AI capabilities are added **detached** (separate adapter/harness, wired by composition) so they
  are easy to remove if ineffective/costly. See [[01-sonnet-cache-vs-qwen-benchmark]].
- If sub-spec 01's study shows Sonnet+cache is cost-competitive, a **separate production sub-spec** wires
  it live (swap `vision_parser` model id + compose the caching adapter in the worker, with quota-stable
  metering — cached tokens folded into `inputTokens` so `TokenMeter.total` is unchanged). Not built yet.

## Deferred technical debt (from 01)

- `estimateCostUsd` (`src/core/domain/aiSpend.ts`) is not cache-aware (static stage→role→rate). Fine for
  today's uncached production path; the benchmark owns its own cache-aware cost math. Refine only if
  caching goes live in production.
- Evaluate `auxiliary`-tier (Haiku-class) caching only if those prompts exceed the 1K-token checkpoint minimum.
