# Wobblio MVP Specifications

Based on the v2.4 engineering & product specification. Files are numbered by build order — each phase depends on the previous.

## Build Phases

| Phase | Files | Description |
|---|---|---|
| **Phase 0** | `00-*` | Design system & wireframes — blocking everything else |
| **Phase 1** | `01-*`, `02-*`, `02b-*`, `03-*` | Infrastructure foundation: sandbox, DB/RLS, deployment/hosting, observability bootstrap |
| **Phase 2** | `04-*`, `05-*` | Auth, waitlist, billing — users can't exist without this |
| **Phase 3** | `06-*`, `07-*`, `08-*` | Core product: landing page, ingestion pipeline, data-intelligence layer |
| **Phase 4** | `09-*`, `10-*`, `11-*` | Premium features: households, budgets/shopping, bill splitting/FX/reporting |
| **Phase 5** | `12-*`, `13-*`, `14-*`, `15-*` | Operations & compliance: admin console, security, GDPR, full observability |

## Spec Index

| Status | Spec |
|---|---|
| ✅ Done | [00 — Design System & Wireframes](./00-design-system-wireframes.md) |
| ✅ Done | [01 — Local Development Sandbox](./01-local-development-sandbox.md) |
| ✅ Done | [02 — Infrastructure, Database & RLS](./02-infrastructure-database-rls.md) |
| ✅ Done | [02b — Deployment & Hosting](./02b-deployment-hosting.md) |
| ✅ Done | [03 — Observability Foundation](./03-observability-foundation.md) |
| ✅ Done | [04 — Authentication & Waitlist](./04-authentication-waitlist.md) |
| ✅ Done | [05 — Billing & Stripe](./05-billing-stripe.md) |
| ✅ Done | [06 — Landing Page & Marketing Site](./06-landing-page-marketing.md) |
| ⬜ Next | [07 — Core Ingestion Pipeline](./07-core-ingestion-pipeline.md) |
| ⬜ | [08 — Data Intelligence Layer](./08-data-intelligence-layer.md) |
| ⬜ | [09 — Households](./09-households.md) |
| ⬜ | [10 — Budgets, Shopping Lists & Route Optimizer](./10-budgets-shopping-lists-optimizer.md) |
| ⬜ | [11 — Bill Splitting, FX & Reporting](./11-bill-splitting-fx-reporting.md) |
| ⬜ | [12 — Admin Console](./12-admin-console.md) *(index — split into 12a–12g)* |
| ⬜ | &nbsp;&nbsp;↳ [12a — Admin Foundation](./12a-admin-foundation.md) *(blocks 12b–12f)* |
| ⬜ | &nbsp;&nbsp;↳ [12b — Waitlist Panel](./12b-admin-waitlist.md) |
| ⬜ | &nbsp;&nbsp;↳ [12c — Config & Model Matrix](./12c-admin-config-models.md) |
| ⬜ | &nbsp;&nbsp;↳ [12d — DLQ Inspection & Replay](./12d-admin-dlq.md) |
| ⬜ | &nbsp;&nbsp;↳ [12e — Alias-Curation Queue](./12e-admin-curation.md) |
| ⬜ | &nbsp;&nbsp;↳ [12f — Analytics Dashboards](./12f-admin-analytics.md) |
| ⬜ | &nbsp;&nbsp;↳ [12g — Admin Deployment (CDK)](./12g-admin-deployment.md) |
| ⬜ | [13 — Security Controls](./13-security-controls.md) |
| ⬜ | [14 — GDPR & Data Lifecycle](./14-gdpr-data-lifecycle.md) |
| ⬜ | [15 — Observability, KPIs & Analytics](./15-observability-kpis-analytics.md) |
| ⬜ | [16 — Mobile Capture & Review](./16-mobile-capture-and-review.md) *(Flutter epic — split into 16a–16h)* |
| ⬜ | &nbsp;&nbsp;↳ [16-00 — Mobile Epic Handoff](./16-mobile/16-00-handoff.md) *(living tracker + DAG)* |
| ⬜ | &nbsp;&nbsp;↳ [16a — Flutter Foundation & App Shell](./16-mobile/16a-mobile-foundation.md) |
| ⬜ | &nbsp;&nbsp;↳ [16b — Auth (Cognito on device)](./16-mobile/16b-mobile-auth.md) |
| ⬜ | &nbsp;&nbsp;↳ [16c — Capture & Upload](./16-mobile/16c-mobile-capture.md) |
| ⬜ | &nbsp;&nbsp;↳ [16d — Dashboard & Feedback](./16-mobile/16d-mobile-dashboard-feedback.md) |
| ⬜ | &nbsp;&nbsp;↳ [16e — Review & Correction](./16-mobile/16e-mobile-review.md) |
| ⬜ | &nbsp;&nbsp;↳ [16f — Push Delivery Backend](./16-mobile/16f-push-delivery-backend.md) *(no Flutter SDK)* |
| ⬜ | &nbsp;&nbsp;↳ [16g — Push Client](./16-mobile/16g-push-client.md) |
| ⬜ | &nbsp;&nbsp;↳ [16h — Merchant Search + Tag Vocabulary](./16-mobile/16h-merchant-tag-edits.md) *(deferred)* |

## Key Architectural Decisions

- **Stack:** Flutter (mobile) + Next.js (web), AWS serverless (Lambda, API Gateway, SQS, S3, RDS PostgreSQL db.t3.micro), CDK/TypeScript IaC
- **AI:** AWS Bedrock Converse API; vision model (Qwen-class), auxiliary (Haiku-class), insight (Sonnet-class), embedder (Titan Text V2 512-dim)
- **DB extensions:** `pg_trgm` (fuzzy merchant/product matching) + `pgvector` (product embeddings)
- **Tenancy:** PostgreSQL Row-Level Security via `SET LOCAL app.current_tenant_id`
- **Hosting:** Next.js static export (`output: 'export'`) → S3 + CloudFront (`wobblio.com`); backend via Lambda + API Gateway with custom domain `api.wobblio.com`; no Amplify
- **Billing:** Stripe Checkout + webhooks, web-only (no in-app purchase)
- **Capacity envelope:** 10k registered users, ~4k MAU, ~3k invoice ingestions/day on db.t3.micro
- **Launch market:** Netherlands, Eindhoven region
