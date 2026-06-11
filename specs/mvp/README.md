# Wobblio MVP Specifications

Based on the v2.4 engineering & product specification. Files are numbered by build order — each phase depends on the previous.

## Build Phases

| Phase | Files | Description |
|---|---|---|
| **Phase 0** | `00-*` | Design system & wireframes — blocking everything else |
| **Phase 1** | `01-*`, `02-*`, `03-*` | Infrastructure foundation: sandbox, DB/RLS, observability bootstrap |
| **Phase 2** | `04-*`, `05-*` | Auth, waitlist, billing — users can't exist without this |
| **Phase 3** | `06-*`, `07-*`, `08-*` | Core product: landing page, ingestion pipeline, data-intelligence layer |
| **Phase 4** | `09-*`, `10-*`, `11-*` | Premium features: households, budgets/shopping, bill splitting/FX/reporting |
| **Phase 5** | `12-*`, `13-*`, `14-*`, `15-*` | Operations & compliance: admin console, security, GDPR, full observability |

## Spec Index

- [00 — Design System & Wireframes](./00-design-system-wireframes.md)
- [01 — Local Development Sandbox](./01-local-development-sandbox.md)
- [02 — Infrastructure, Database & RLS](./02-infrastructure-database-rls.md)
- [03 — Observability Foundation](./03-observability-foundation.md)
- [04 — Authentication & Waitlist](./04-authentication-waitlist.md)
- [05 — Billing & Stripe](./05-billing-stripe.md)
- [06 — Landing Page & Marketing Site](./06-landing-page-marketing.md)
- [07 — Core Ingestion Pipeline](./07-core-ingestion-pipeline.md)
- [08 — Data Intelligence Layer](./08-data-intelligence-layer.md)
- [09 — Households](./09-households.md)
- [10 — Budgets, Shopping Lists & Route Optimizer](./10-budgets-shopping-lists-optimizer.md)
- [11 — Bill Splitting, FX & Reporting](./11-bill-splitting-fx-reporting.md)
- [12 — Admin Console](./12-admin-console.md)
- [13 — Security Controls](./13-security-controls.md)
- [14 — GDPR & Data Lifecycle](./14-gdpr-data-lifecycle.md)
- [15 — Observability, KPIs & Analytics](./15-observability-kpis-analytics.md)

## Key Architectural Decisions

- **Stack:** Flutter (mobile) + Next.js (web), AWS serverless (Lambda, API Gateway, SQS, S3, RDS PostgreSQL db.t3.micro), CDK/TypeScript IaC
- **AI:** AWS Bedrock Converse API; vision model (Qwen-class), auxiliary (Haiku-class), insight (Sonnet-class), embedder (Titan Text V2 512-dim)
- **DB extensions:** `pg_trgm` (fuzzy merchant/product matching) + `pgvector` (product embeddings)
- **Tenancy:** PostgreSQL Row-Level Security via `SET LOCAL app.current_tenant_id`
- **Billing:** Stripe Checkout + webhooks, web-only (no in-app purchase)
- **Capacity envelope:** 10k registered users, ~4k MAU, ~3k invoice ingestions/day on db.t3.micro
- **Launch market:** Netherlands, Eindhoven region
