# NF-01/08 — PDF Ingestion Cost Truth + Deficit Function Wiring

**Parent:** [`01-data-ai-pipeline.md`](../01-data-ai-pipeline.md) · **Priority: P3 (capacity/cost
risk: the credit model's fairness and the cost KPIs both under-count the most expensive input
class)** · **Tag:** [GAP] · **DB migration:** none · **validate:security:** n/a.

## Findings

1. **PDF parses are cost-priced as if they ran the vision model.** `estimateCostUsd` prices the
   `VISION_PARSE` stage with a hardcoded vision-class rate, but PDF documents route to the
   dedicated `pdf_parser` model role (exclusive, no fallback — dev: `eu.anthropic.claude-sonnet-4-6`),
   which is materially more expensive per token. Recorded as a LANDMINE in the NF-01 handoff
   (`00-handoff.md`) when telemetry shipped (2026-06-29) and never fixed. Effects: pipeline-cost
   KPIs under-report, and the credit calibration (`avg_tokens` from real `bedrock_usage`) treats
   PDF and photo uploads as equally priced when they are not. PDF upload is Premium-gated, so this
   silently subsidizes the paid tier's heaviest usage.
2. **`admin_pipeline_cost_deficit` has no caller.** The SQL function shipped with NF-01 telemetry;
   the KPI comparison page (NF-01/06) went a different way and nothing invokes it. Dead surface —
   either wire it into the AI-spend dashboard (a "cost vs credit revenue deficit" card is exactly
   the runaway-spend signal an operator wants) or drop it in a migration.

## Proposed fix

1. Make stage-cost pricing **model-aware**: price each `bedrock_usage` record by the model id it
   actually recorded (the telemetry already stores per-stage model usage), with the rate table as
   an SSM/config map instead of per-stage constants. Recalibrate `avg_tokens`/credit-cost for the
   PDF path once true numbers exist.
2. Decide the deficit function's fate; if kept, surface it on the admin AI-spend page (see
   [ADMIN] fix `specs/fixes/03-admin-incident-workflows.md` §C).

## Acceptance

A PDF ingestion's `invoice_telemetry` cost row within ±10% of the Bedrock console's billed cost
for the same invocation; KPI pipeline-cost chart re-baselined; no orphan SQL functions.
