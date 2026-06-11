# 03 — Observability Foundation (Minimal Slice)

**Epic 14 (Phase 1 slice) | Phase 1 | Must precede the first AI call**

## Overview

The minimal observability slice that must exist before any feature work begins. Observability is cheapest to wire up on an empty system, and the cost alarm must predate the first Bedrock call. The full observability platform (dashboard, alarm inventory, KPI system) ships in Phase 5 — this spec covers only the bootstrap.

## Dependencies

- [02 — Infrastructure, Database & RLS](./02-infrastructure-database-rls.md)

## What Ships in This Phase

1. Structured logging (JSON via Embedded Metric Format) on all Lambda functions
2. AWS Budgets alarm at €100/month threshold
3. Bedrock token metrics (input tokens, output tokens, model role, stage) emitted via EMF
4. SNS ops topic with email subscription

## What is Deferred to Phase 5

Full CloudWatch dashboard, all alarm definitions, business KPI aggregation, Athena analytics, payment analytics.

## Structured Logging Conventions

All Lambda logs emitted as JSON (Embedded Metric Format for metrics, plain JSON for logs):

```json
{
  "_aws": { "Timestamp": ..., "CloudWatchMetrics": [...] },
  "service": "ingestion-worker",
  "tenantId": "...",
  "stage": "PRODUCT_NORMALIZATION",
  "modelId": "...",
  "promptVersion": "v1",
  "inputTokens": 1024,
  "outputTokens": 256,
  "durationMs": 1234,
  "level": "INFO"
}
```

Required fields on every log line: `service`, `level`, `requestId` (from Lambda context).

## Bedrock Token Metric Dimensions

Every Bedrock call emits these CloudWatch custom metrics via EMF:
- `Stage` (VISION_PARSE, MERCHANT_FALLBACK, PRODUCT_EXPANSION, CLASSIFICATION_TIEBREAK, WEEKLY_ADVISOR, EMBEDDING)
- `ModelId` (opaque SSM value)
- `InputTokens`, `OutputTokens` (per-call)
- `EstimatedCost` (derived from token counts × per-token rate)

These feed the `ai_spend_ledger` table and the per-tenant daily spend cap enforcement.

## SNS Ops Topic

One SNS topic per environment: `wobblio-ops-{env}`. Email subscription on creation. Chat-webhook subscriber can be added later without architecture change. All alarms route to this topic.

## AWS Budgets

- Monthly budget: €100
- Alert thresholds: 50%, 80%, 100%
- Notification: email (can route to SNS ops topic via action)
- Cost Anomaly Detection (free): alert on anomaly >€10

---

## Checklist

### Structured Logging
- [ ] JSON logging library configured in Lambda runtime (Node.js: `pino` or equivalent)
- [ ] Lambda wrapper that adds `requestId`, `service`, `level` to every log line
- [ ] EMF metric emission helper for custom CloudWatch metrics
- [ ] Log retention set to 30 days hot on all log groups (S3 archive lifecycle thereafter)

### Bedrock Token Tracking
- [ ] `BedrockCallMetrics` helper: wraps every Converse API call, captures input/output tokens
- [ ] Emits EMF metric with dimensions: Stage, ModelId, InputTokens, OutputTokens
- [ ] Writes to `ai_spend_ledger` table: `(tenant_id, date, model_role, input_tokens, output_tokens, est_cost)`
- [ ] Per-tenant daily spend soft cap: read from SSM `/wobblio/config/ai/daily_spend_cap`; log warning + skip call if exceeded

### SNS Ops Topic
- [ ] Create `wobblio-ops-{env}` SNS topic in `WobblioAppStack`
- [ ] Email subscription: ops email address from SSM parameter
- [ ] Export topic ARN as CDK output for use by future alarm definitions

### AWS Budgets
- [ ] Monthly budget €100 in CDK (via `aws-budgets` L1 construct)
- [ ] Alert at 50%, 80%, 100% of forecasted spend
- [ ] Notification action: email to ops address
- [ ] Cost Anomaly Detection monitor targeting the Wobblio AWS account/tags
- [ ] Anomaly alert threshold: >€10

### SSM Parameter Bootstrap
- [ ] `/wobblio/config/models/vision_parser` — initial model ID
- [ ] `/wobblio/config/models/auxiliary` — initial model ID
- [ ] `/wobblio/config/models/embedder` — `amazon.titan-embed-text-v2:0`
- [ ] `/wobblio/config/models/insight` — initial model ID
- [ ] `/wobblio/config/ai/daily_spend_cap` — initial daily per-tenant cap (e.g., €0.10)
- [ ] `/wobblio/config/capacity/max_free_users_cap` — initial cap (e.g., 5000)
- [ ] `/wobblio/config/routing/min_split_saving` — `5.00`
- [ ] `/wobblio/config/routing/max_stores` — `3`
- [ ] `/wobblio/config/tags/vocabulary` — JSON array of tag definitions
- [ ] `/wobblio/config/tags/dedicated_call_enabled` — `false`
- [ ] All prompt version references (one per Appendix B operation)
