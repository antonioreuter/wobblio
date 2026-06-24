# Admin Console — Implementation-Ready Sub-Specs

Decomposition of the parent epic [12 — Admin Console](../12-admin-console.md) into smaller,
self-contained, build-ordered specs. The parent file remains the canonical epic summary; these
sub-specs are what you implement against.

The admin console is a **separate Next.js app** (`Source/admin/`) deployed to `admin.wobblio.com`
— never routes inside the main webapp. It is gated to the `ADMIN` role at the edge (middleware) and
again server-side on every backend endpoint.

## Build order

`00` is the foundation and blocks every other sub-spec (no admin page or endpoint works without
auth + the admin route module). `01` (hosting) can proceed in parallel with the feature specs once
`00`'s contracts are agreed. `02`–`06` are independent of each other and can be built in any order.
**`07` and `08` are gated by [Epic 15](../15-observability-kpis-analytics.md)** — both render from
`kpi_daily`, and the business-KPI + AI-spend aggregates they need are not rolled up yet (only ingestion
timing is). Build 15's nightly KPI job before, or as part of, those two pages.

| # | Sub-spec | Backend readiness | Notes |
|---|---|---|---|
| 00 | [Access Control, Routing & Audit](./00-access-control-routing-audit.md) | `checkAdminRole` done; `verifySessionJwt` missing | **Foundation — blocks all** |
| 01 | [CDK Hosting & WAF](./01-cdk-hosting-waf.md) | not implemented | separate CloudFront + Route53 + WAF |
| 02 | [SSM Parameter Editor](./02-ssm-parameter-editor.md) | SSM read infra exists | adds write + audit |
| 03 | [Model-Swap Matrix](./03-model-swap-matrix.md) | model SSM params not read by any adapter | **folds in** SSM model adapter |
| 04 | [Waitlist Panel](./04-waitlist-panel.md) | release cron exists | thin read + release wrapper |
| 05 | [DLQ Inspection & Replay](./05-dlq-panel.md) | DLQ in CDK; no read grant | adds SQS read grant + endpoints |
| 06 | [Alias-Curation Queue](./06-alias-curation-queue.md) | catalog tables ready; no corroboration count | **folds in** pending-tenant tracking |
| 07 | [AI-Spend Dashboard](./07-ai-spend-dashboard.md) | ledger + per-tenant cap removed 2026-06-22 | **needs Epic 15** AI-spend rollup into `kpi_daily`; aggregate-only |
| 08 | [KPI Dashboard](./08-kpi-dashboard.md) | `kpi_daily` exists; only timing rolled up | **needs Epic 15** business-KPI nightly job first |

## Implementation sequence

Dependency-driven order. **Critical path:** `00` → Epic 15 KPI job → `07`/`08` (longest pole, so start
the Epic 15 work in parallel with Phase 1).

**Phase 0 — foundation (blocks everything)**
1. `00` Access Control, Routing & Audit — `verifySessionJwt` + middleware wiring, `adminRoutes.ts` +
   server-side guard, `admin_audit_log` table + port/adapter. No feature can start before this.

**Phase 1 — ready features (only need `00`; parallelizable, ordered by value/cost)**
2. `04` Waitlist — cheapest; release service + count adapters already exist.
3. `05` DLQ — DLQ exists in CDK; add SQS read grant + endpoints. High ops value.
4. `02` SSM Parameter Editor — SSM read infra exists; add write + audit.

**Phase 2 — features with folded-in backend prerequisites**
5. `03` Model Matrix — build `SsmModelRegistryAdapter` first (also unblocks the ingestion worker's
   hardcoded-model cleanup).
6. `06` Alias Curation — needs corroboration/pending-tenant tracking + resolves the `REJECTED` enum
   drift; heaviest schema work.

**Phase 3 — gated by Epic 15**
7. Epic 15 business-KPI nightly job — extend `cron-ingestion-metrics-rollup` to roll
   registrations/DAU/MAU/MRR/churn/conversion/feedback + AI-spend aggregates into `kpi_daily`.
   **Prerequisite for the two dashboards.**
8. `08` KPI Dashboard — thin once 15 lands.
9. `07` AI-Spend Dashboard — thin once 15 rolls up `bedrock_usage` tokens/cost; aggregate-only.

**Parallel track — anytime after `00`**
- `01` CDK Hosting & WAF — independent of feature work; land before any real `admin.wobblio.com` deploy.

**Compact sequence:** `00` → (`04`, `05`, `02` ∥ `01` ∥ Epic 15 job) → `03` → `06` → `08` → `07`.

## Cross-cutting invariants (apply to every sub-spec)

- **Role is never client-writable.** `ADMIN` is set only by direct DB manipulation, never via any API
  (root invariant #5). Admin endpoints must reject any attempt to mutate `role`.
- **Edge gate + server gate.** Middleware enforces `ADMIN` at page entry; every `/admin/*` backend
  endpoint independently re-checks the role from the verified JWT. Middleware alone is not sufficient.
- **No plain-text role cookie.** Spoofable — flagged as a critical auth bypass (2026-06-11). Role is
  read only from a verified Cognito JWT (`custom:role` claim).
- **Audit every mutation.** SSM edits, model swaps, DLQ deletes/replays, curation decisions, and
  waitlist releases each write an audit-log row (see `00`).
- **Conventions.** Backend follows hexagonal ports/adapters (`Source/backend/CLAUDE.md`); admin API
  routes mirror the existing `*Routes.ts` module pattern in `Source/backend/src/handlers/api-handler/`.

## Open decisions / blockers surfaced by this breakdown

1. **AI-spend is aggregate-only** (`07`) — `ai_spend_ledger` and the per-tenant daily cap were removed
   2026-06-22 (cost bounded by the weekly invoice quota). Dashboard reads `kpi_daily`; per-tenant
   top-spenders and cap-breach are dropped. Reinstating them needs a new per-tenant aggregate table
   (separate amendment), not the ledger.
2. **Catalog status has no `REJECTED`** — the live enums are `merchant_status`/`catalog_status` =
   `('PROVISIONAL','ACTIVE','INACTIVE')`. The parent spec's "Reject → REJECTED" must map to `INACTIVE`
   or add an enum value. See `06`.
3. **Corroboration / pending-tenant count is not tracked** in the schema — required to sort the
   curation queue. Folded into `06` as a prerequisite.
4. **Model SSM params are not read by any adapter** yet — folded into `03` as a prerequisite.
5. **Epic 15 business-KPI rollup is a hard prerequisite for `07` + `08`** — `kpi_daily` only holds
   ingestion-timing rows today; registrations/DAU/MAU/MRR/churn/conversion/feedback and AI-spend
   aggregates must be produced by [15](../15-observability-kpis-analytics.md)'s nightly job first.
