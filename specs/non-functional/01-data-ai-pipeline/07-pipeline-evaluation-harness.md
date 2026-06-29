# 07 — Pipeline Evaluation Harness (LLM-as-a-Judge)

**Non-Functional 01 · Phase 3/5 · Offline pre-launch comparison**

Parent: [../01-data-ai-pipeline.md](../01-data-ai-pipeline.md) §7 · Index: [README](./README.md)

## Overview

A local CLI that runs both pipelines against a ground-truth fixture set in dry-run mode and
grades the outputs with a more capable model (LLM-as-a-judge), producing a comparative summary
(accuracy, latency, cost) to decide whether to enable the agentic pipeline.

## Dependencies

- [03 — Strands Agent Worker](./03-strands-agent-worker.md) — needs the worker pipeline
  extracted into a **reusable processor** callable in dry-run (no DB writes, no price emission).
  Flag this extraction in 03; consume it here.
- Reuses: `IngestionService` (legacy path), the Strands agent + tools, the `insight` model role.

## Design

### 1. Runner — `scripts/evaluate-pipelines.ts` (`npm run compare:pipelines`)

- Input: `invoices/fixtures/evaluation-set/` (receipt images + curated ground-truth JSON).
- Runs each fixture through `LegacyInvoiceProcessorAdapter` and
  `StrandsAgentInvoiceProcessorAdapter` in **dry-run** (bypass DB + price observations).
- Collects per-pipeline processing time, tokens, API cost, and output JSON.

### 2. LLM-as-a-judge

- Model: `insight` role (e.g. Sonnet-class) via `IModelRegistry`.
- XML-separated evaluator prompt (parent §7): grades both outputs vs ground truth on extraction
  accuracy, line-item completeness, classification alignment, tag relevance → strict JSON
  (`legacy_scores`, `agentic_scores`, `analysis`). Schema-validate the judge output.

### 3. Output

Aggregate into a comparative summary table: average scores per criterion, average latency,
average cost per invoice — for both pipelines.

## Checklist

- [ ] Reusable dry-run processor extracted (from [03](./03-strands-agent-worker.md)) for both pipelines
- [ ] `scripts/evaluate-pipelines.ts` runs fixtures through both pipelines (dry-run), collects metrics
- [ ] `insight`-role judge with XML prompt; judge output schema-validated
- [ ] Comparative summary table (scores, latency, cost)
- [ ] `npm run compare:pipelines` documented; fixtures present under `invoices/fixtures/evaluation-set/`
