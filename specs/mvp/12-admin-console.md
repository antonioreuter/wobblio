# 12 — Admin Console

**Epic 10 | Phase 5 | Operational tooling for ADMIN role**

## Overview

> **Implementation-ready breakdown:** this epic is decomposed into per-section sub-specs under
> [`./admin-console/`](./admin-console/README.md) (build order, dependency/blocker matrix, and the
> folded-in backend prerequisites). This file remains the canonical epic summary; build against the
> sub-specs.

Web-only admin console, middleware-gated to `ADMIN` role. Provides live SSM parameter editing, model-swap matrix, waitlist management, DLQ inspection/replay, merchant/product alias-curation queue, and AI-spend dashboard.

**Architecture decision (2026-06-11):** The admin console is a **separate Next.js application** (`Source/admin/`) deployed to its own domain `admin.wobblio.com`. It is NOT part of the main webapp (`wobblio.com`). Rationale: isolated attack surface, separate deployment, strict server-side role enforcement with no admin routes or components leaking into the customer-facing app.

Current status: scaffold exists at `Source/admin/` with middleware stub (fail-secure — denies all requests) and 7 route stubs. Full implementation is blocked on the backend API (Epic 2, 4, 7, 8, 15).

## Dependencies

- [02 — Infrastructure, Database & RLS](./02-infrastructure-database-rls.md)
- [04 — Authentication & Waitlist](./04-authentication-waitlist.md)
- [07 — Core Ingestion Pipeline](./07-core-ingestion-pipeline.md) (DLQ access)
- [08 — Data Intelligence Layer](./08-data-intelligence-layer.md) (alias curation, model matrix)
- [15 — Observability, KPIs & Analytics](./15-observability-kpis-analytics.md) (KPI dashboard)

## Access Control

- **Separate domain:** `admin.wobblio.com` — not a route group within the main webapp
- **Next.js middleware** (`Source/admin/src/middleware.ts`) runs on every request before any route handler; redirects to `/403` if role is not `ADMIN`
- **Authentication mechanism:** validate the Cognito session JWT from the session cookie using the User Pool JWKS endpoint; extract the `custom:role` claim; pass to `checkAdminRole()`. **Do NOT use a plain-text cookie for role** — this was flagged as a critical auth bypass (spoofable field); any user can set an arbitrary cookie value
- ADMIN role set only via direct DB manipulation (never via any API mutation)
- Server-side role check on every admin API endpoint (not just the middleware at page entry)
- Consider WAF rule or IP allowlist on the CloudFront distribution for `admin.wobblio.com`

## Middleware Implementation Pattern

```ts
// Source/admin/src/middleware.ts
import { verifySessionJwt } from '@/lib/verify-session-jwt'  // to be implemented
import { checkAdminRole } from '@/lib/check-admin-role'      // implemented + tested

const session = await verifySessionJwt(
  request.cookies.get('session')?.value,
  process.env.SESSION_SECRET   // Cognito User Pool JWKS URI or app client secret
)
if (!session || !checkAdminRole(session.role)) {
  return NextResponse.redirect(new URL('/403', request.url))
}
return NextResponse.next()
```

`checkAdminRole(role: string | undefined): boolean` is already implemented and tested at `Source/admin/src/lib/check-admin-role.ts`. `verifySessionJwt` must be implemented when Cognito is wired up (Epic 4).

## Admin Console Sections

### 1. SSM Parameter Editor

Live editing of all tunable parameters. Changes take effect on next Lambda warm start or SSM cache expiry.

Parameters exposed:
- `max_free_users_cap` — waitlist trigger
- `routing/min_split_saving` — route optimizer saving threshold (€)
- `routing/max_stores` — max stores in split route
- `tags/vocabulary` — JSON tag vocabulary with trigger maps
- `tags/dedicated_call_enabled` — boolean toggle
- Per-model token ceilings (vision_parser, auxiliary, insight, embedder)

UI: table of parameter name / current value / edit input / save button. Confirmation modal for sensitive changes.

### 2. Model-Swap Matrix

Live swapping of AI model IDs by role. Changes the SSM value; running Lambda containers pick it up on next cold start or SSM cache expiry.

| Model Role | Current ID | New ID | Swap Button |
|---|---|---|---|
| `vision_parser` | (from SSM) | text input | Confirm swap |
| `auxiliary` | (from SSM) | text input | Confirm swap |
| `insight` | (from SSM) | text input | Confirm swap |
| `embedder` | (from SSM) | text input | Confirm swap |

Confirmation modal states: "Changing vision_parser will affect all new ingestions. The DOWN-ratio alarm is the canary for a bad swap — monitor it for 30 minutes after swapping."

### 3. Waitlist Panel

- Live free-user count vs. `max_free_users_cap`
- Waitlist queue size (users in `STATUS_WAITLIST`)
- "Release N users" button (runs the FIFO release job for N users)
- Raise cap: edit `max_free_users_cap` (links to SSM param editor)

### 4. DLQ Inspection & Replay Panel

- Lists messages in the ingestion DLQ (SQS `ReceiveMessage` with `MaxNumberOfMessages`)
- Per message: payload preview (truncated), tenant ID, S3 key, error detail (from CloudWatch log correlation), attempt count, first-failure timestamp
- Actions per message:
  - **Inspect**: open full payload in modal
  - **Replay**: move message back to ingestion queue (delete from DLQ, send to main queue)
  - **Delete**: discard permanently (with confirmation)
- Bulk replay all / bulk delete all (with confirmation)

### 5. Alias-Curation Queue

Two queues: **merchant queue** (provisional merchants) and **product queue** (provisional products), sorted by "how many tenants are waiting on them" (pending corroboration count, descending).

Per item:
- Entity name + raw aliases that resolved to it
- Number of contributing tenants waiting on promotion
- Corroboration status (eligible corroborator count / quorum)
- Actions: **Approve** (set `status=ACTIVE`), **Merge** (merge into an existing entity, retarget aliases), **Reject** (set rejected status, aliases retargeted or cleared). Note: live enums `merchant_status`/`catalog_status` are `('PROVISIONAL','ACTIVE','INACTIVE')` — no `REJECTED`. Reject maps to `INACTIVE` or adds a `REJECTED` value; decide in the migration. See [`./admin-console/06-alias-curation-queue.md`](./admin-console/06-alias-curation-queue.md).

### 6. AI-Spend Dashboard

> **Amended 2026-06-22:** `ai_spend_ledger` and the per-tenant daily AI-spend cap were **removed**
> (cost is now bounded by the weekly invoice quota; telemetry is `bedrock_usage` logs rolled into
> `kpi_daily` nightly). There is no per-tenant spend store and no cap to breach. This dashboard is
> **aggregate-only** unless a new per-tenant source is built. See
> [`./admin-console/07-ai-spend-dashboard.md`](./admin-console/07-ai-spend-dashboard.md).

- Daily bar chart: total tokens (input + output) and estimated cost, segmented by model role
  (sourced from `kpi_daily` / `bedrock_usage` logs)
- Date range picker (default: last 30 days)
- Per-tenant top-spenders table — **dropped** (no per-tenant source after the ledger removal; build a
  new aggregate table to reinstate)
- Cap-breach indicator — **dropped** (the per-tenant daily cap no longer exists)

### 7. KPI Dashboard

(See also [15 — Observability, KPIs & Analytics](./15-observability-kpis-analytics.md))

- Stat cards: registrations today, DAU, premium subscribers, MRR, conversion rate, churn rate
- 90-day sparklines for key metrics (read from `kpi_daily` table)
- Date-range picker
- Feedback score (UP ÷ total votes) — proxy for OCR quality

---

## Checklist

### Architecture
- [x] Admin console is a separate Next.js app at `Source/admin/` — NOT routes in the main webapp
- [x] Deployed to `admin.wobblio.com` (separate CloudFront distribution — CDK not yet implemented)
- [x] Admin nav item removed from main webapp `LeftNav`
- [x] Admin UI components (`AdminDLQPanel`, `AdminAliasCurationPanel`) moved to `Source/admin/` only

### Access Control
- [x] Next.js middleware scaffold: fail-secure (denies all by default) at `Source/admin/src/middleware.ts`
- [x] `checkAdminRole(role)` helper implemented and tested (4 tests: undefined, wrong role, lowercase, ADMIN)
- [ ] **`verifySessionJwt(cookie, secret)`** — validate Cognito session JWT via JWKS; extract `custom:role` claim. Wire into middleware. **Do NOT use a plain-text role cookie — spoofable (critical security finding 2026-06-11)**
- [ ] Server-side role check on every admin API endpoint (not just page-level middleware)
- [ ] ADMIN role cannot be set via any API — documented in RBAC
- [ ] CDK: separate CloudFront distribution + Route53 A record for `admin.wobblio.com`
- [ ] Consider WAF IP allowlist on admin CloudFront distribution

### SSM Parameter Editor
- [ ] `GET /admin/config` — list all tunable SSM parameters with current values
- [ ] `PUT /admin/config/{param}` — update SSM parameter value (ADMIN only)
- [ ] Confirmation modal for high-impact params (cap changes, model swaps)
- [ ] Audit log entry for each parameter change (stored in CloudWatch or a dedicated table)

### Model-Swap Matrix
- [ ] `GET /admin/models` — current model IDs from SSM for all 4 roles
- [ ] `PUT /admin/models/{role}` — update model ID in SSM
- [ ] Warning modal with DOWN-ratio alarm monitoring guidance
- [ ] Model swap history log (parameter change audit)

### Waitlist Panel
- [ ] `GET /admin/waitlist` — current count, cap, waitlist queue size
- [ ] `POST /admin/waitlist/release` with `{ count: N }` — run FIFO release for N users
- [ ] Link to SSM param editor for cap change

### DLQ Panel
- [ ] `GET /admin/dlq/messages` — list DLQ messages (paginated)
- [ ] `GET /admin/dlq/messages/{messageId}` — full message payload
- [ ] `POST /admin/dlq/messages/{messageId}/replay` — move to ingestion queue
- [ ] `DELETE /admin/dlq/messages/{messageId}` — discard from DLQ
- [ ] `POST /admin/dlq/replay-all` — replay all (with confirmation, count limit)
- [ ] `DELETE /admin/dlq/delete-all` — discard all (with confirmation)
- [ ] CloudWatch log correlation: link from DLQ message to relevant Lambda log stream

### Alias-Curation Queue
- [ ] `GET /admin/curation/merchants?status=PROVISIONAL` — sorted by pending-tenant count
- [ ] `GET /admin/curation/products?status=PROVISIONAL` — sorted by pending-tenant count
- [ ] `POST /admin/curation/merchants/{id}/approve` — set status ACTIVE
- [ ] `POST /admin/curation/merchants/{id}/merge` with `{ targetId }` — merge + retarget aliases
- [ ] `POST /admin/curation/merchants/{id}/reject` — set rejected status (`INACTIVE`, or add `REJECTED` enum value)
- [ ] Same endpoints for products
- [ ] Batch actions: approve/reject selected items

### AI-Spend Dashboard
- [ ] `GET /admin/ai-spend?from=...&to=...` — daily aggregate totals by model role (from `kpi_daily` / `bedrock_usage` logs)
- [ ] Bar chart: tokens + cost by model role, date range picker
- [ ] ~~Per-tenant top-spenders~~ / ~~cap-breach indicator~~ — dropped (ledger + per-tenant cap removed 2026-06-22)

### KPI Dashboard
- [ ] `GET /admin/kpis?metrics=...&from=...&to=...` — reads from `kpi_daily` table
- [ ] Stat cards: registrations today, DAU, premium count, MRR, conversion rate, churn rate
- [ ] 90-day sparklines via time-series query on `kpi_daily`
- [ ] Feedback score trend (UP ratio)

### Admin UI Navigation
- [x] Admin console is its own app — no admin link in the main webapp nav (access via direct URL `admin.wobblio.com`)
- [x] Sub-navigation sidebar scaffolded in `Source/admin/src/app/(console)/layout.tsx` (Hub, SSM Config, Model Matrix, Waitlist, DLQ, Alias Curation, AI Spend, KPIs)
- [ ] Confirmation modals on all destructive/high-impact actions (model swap, bulk DLQ delete, cap changes)
