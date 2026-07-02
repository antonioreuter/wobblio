# 07b — Complete the Feedback Loop (reasons, free-text, model snapshot)

**Parent:** [07 — Core Ingestion Pipeline](../07-core-ingestion-pipeline.md) · **Priority: P3
(the "quality flywheel" the spec calls a ship-blocker is half-built; model-swap comparison —
the stated purpose of the admin model matrix — has no per-verdict model provenance)** ·
**Tag:** [GAP] · **DB migration:** likely none (columns exist) → **but run `validate:security`**
because `invoice_feedback` adapter SQL changes.

## Gap

Spec `07:108-116` requires: thumbs up/down, a 3-chip reason picker, optional free-text, and
storage "in `invoice_feedback` with `model_ids_snapshot` (model IDs + prompt versions)".

What shipped: thumbs verdict only.
`InvoiceFeedbackRepositoryAdapter.upsert` (`Source/backend/src/infrastructure/adapters/ingestion/InvoiceFeedbackRepositoryAdapter.ts`)
writes `(invoice_id, tenant_id, verdict)` and nothing else. `model_ids_snapshot` and `comment_enc`
exist only as columns in `20260611152000_initial_schema.ts` — never written by any code path.
Consequences:

- The admin **model matrix** swap-comparison story (models 03 sub-spec, `Source/backend/CLAUDE.md`
  "Every model invocation records prompt_version into invoice_feedback.model_ids_snapshot") is
  unfulfillable — a DOWN verdict can't be attributed to the model/prompt version that produced it.
- The KPI feedback breakdown (`20260623170000_kpi_feedback_breakdown.ts`) segments by verdict only.
- **Invariant #9** lists `invoice_feedback.comment_enc` in the narrow encryption scope; today no
  comment is captured at all, so the invariant is vacuously satisfied — but the moment someone adds
  free-text without reading §7.5, it lands in plaintext.

## Proposed fix (tightly scoped)

1. Worker: at terminal-status write, persist the active model-role → model-id + `prompt_version`
   map onto the invoice's feedback-context (either stamp `invoice` or write-through at feedback
   time from `invoice_telemetry`, which already records per-stage model usage — prefer the
   telemetry join, zero new writes on the hot path).
2. Feedback endpoint: accept optional `reason` (enum: `WRONG_ITEMS | WRONG_MERCHANT_TOTAL | OTHER`)
   + optional free-text; free-text encrypts via the existing `IKmsEncryption` port into
   `comment_enc` (invariant #9 pattern: `ShareInvoiceService`).
3. Surface reason distribution in the existing admin KPI feedback panel.
4. Web + mobile affordance: web drawer chips; mobile is already wired for verdicts (16d) — extend.

## Out of scope

Trust scoring changes, the DOWN-ratio alarm (03-observability owns alarms), 16h merchant/tag edits.
