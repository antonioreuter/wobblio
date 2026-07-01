# 12 — Admin Console

**Epic 10 | Phase 5 | Operational tooling for ADMIN role**

> **This epic is split into vertical-slice sub-specs (`12a`–`12g`).** This file is the index
> and shared context. Each section's detail, endpoints, and checklist live in its sub-spec.

## Overview

Web-only admin console, gated to `ADMIN` role. Provides live SSM parameter editing, model-swap
matrix, waitlist management, DLQ inspection/replay, merchant/product alias-curation queue, and
AI-spend + KPI dashboards.

**Architecture decision (2026-06-11):** The admin console is a **separate Next.js application**
(`Source/admin/`) deployed to its own domain `admin.wobblio.com`. It is NOT part of the main
webapp (`wobblio.com`). Rationale: isolated attack surface, separate deployment, strict
server-side role enforcement with no admin routes or components leaking into the customer-facing
app.

Current status: scaffold exists at `Source/admin/` — fail-secure middleware stub (denies all),
8 route stubs under `(console)/`, and two ready domain components (`admin-dlq-panel`,
`admin-alias-curation-panel`). The **backend has zero `/admin/*` routes** today; all admin
endpoints are new work.

## Sub-spec map (build order)

| Spec | Scope | Blocking | Status |
|---|---|---|---|
| [12a — Admin Foundation](./12-admin-console/12a-admin-foundation.md) | Auth (`verifySessionJwt` + middleware role gate), `/admin/*` backend route family + per-endpoint ADMIN check, audit log | **Blocks 12b–12f** | ⬜ |
| [12b — Waitlist Panel](./12-admin-console/12b-admin-waitlist.md) | GET count/cap/queue + POST release | 12a | ⬜ |
| [12c — Config & Model Matrix](./12-admin-console/12c-admin-config-models.md) | SSM param editor + model-swap matrix (shared config port) | 12a | ⬜ |
| [12d — DLQ Inspection & Replay](./12-admin-console/12d-admin-dlq.md) | list/inspect/replay/delete + bulk (new DLQ reader port) | 12a, 07 | ⬜ |
| [12e — Alias-Curation Queue](./12-admin-console/12e-admin-curation.md) | approve/merge/reject merchant+product (new ranking) | 12a, 08 | ⬜ |
| [12f — Analytics Dashboards](./12-admin-console/12f-admin-analytics.md) | AI-Spend + KPI dashboards (read `kpi_daily`) | 12a, 15 | ⬜ |
| [12g — Admin Deployment (CDK)](./12-admin-console/12g-admin-deployment.md) | CloudFront + Route53 + WAF for `admin.wobblio.com` | 12a | ⬜ |

## Cross-epic dependencies

- [02 — Infrastructure, Database & RLS](./02-infrastructure-database-rls.md)
- [04 — Authentication & Waitlist](./04-authentication-waitlist.md)
- [07 — Core Ingestion Pipeline](./07-core-ingestion-pipeline.md) (DLQ access)
- [08 — Data Intelligence Layer](./08-data-intelligence-layer.md) (alias curation, model matrix)
- [15 — Observability, KPIs & Analytics](./15-observability-kpis-analytics.md) (KPI dashboard)

## Shared access-control rules (apply to every sub-spec)

- **Separate domain:** `admin.wobblio.com` — not a route group within the main webapp.
- **Next.js middleware** (`Source/admin/src/middleware.ts`) runs on every request before any
  route handler; redirects to `/403` if role is not `ADMIN`. Defined in **12a**.
- **Do NOT use a plain-text cookie for role** — spoofable (critical finding 2026-06-11).
  Validate the session and read role from the trusted source (see 12a auth decision).
- ADMIN role is set **only via direct DB manipulation** — never via any API mutation.
- **Server-side role check on every admin API endpoint**, not just the page-level middleware.
- Consider a WAF rule / IP allowlist on the `admin.wobblio.com` CloudFront distribution (12g).

`checkAdminRole(role: string | undefined): boolean` is already implemented and tested at
`Source/admin/src/lib/check-admin-role.ts` (returns true only for exact `'ADMIN'`).

## Known gaps surfaced during decomposition (resolved in owning sub-spec)

- **Backend has no `/admin/*` routes** — all endpoints are new (12a sets up the dispatcher).
- **DLQ has no read path** — only `SqsIngestionQueueAdapter` (write). 12d adds a reader.
- **Alias curation has no approve/merge/reject and no pending-tenant ranking** — 12e adds the
  service + a ranking source.
- **`ai_spend_ledger` was dropped** (commit `34941e6`, 2026-06-22; per-tenant daily cap
  removed). Spec §6 originally read from it. 12f re-sources AI-spend from `kpi_daily`.
