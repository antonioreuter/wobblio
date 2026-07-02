# Wobblio — Project Knowledge Bootstrap (post-audit, 2026-07-02)

Standalone orientation for whoever picks this up next. Verified against code + git during the
2026-07-02 full audit ([00-audit-report.md](./00-audit-report.md)); trust this over the README
status table and both CLAUDE.md status lines until Fix 02 lands.

## What the product is

Receipt photos → multimodal-AI extraction → structured personal finance data. The anonymized price
points feed a crowdsourced regional price index (Netherlands, Eindhoven launch) powering the
differentiators: Anti-Inflation Price Engine, Split-Route Shopping Optimizer, proactive budget
protection. Capacity is deliberately small (10k users / ~3k ingestions/day on db.t3.micro) with the
waitlist as load-shedding.

## Stack (as actually deployed)

- **Backend:** Node 24 TypeScript Lambda fleet (`Source/backend/`), strict hexagonal
  (`core/{services,ports,domain}` ↔ `infrastructure/adapters`, enforced by
  `npm run skill:hexagonal-architecture-validator`), API Gateway + SQS + S3, RDS PostgreSQL 15
  (**lives in the separate `shared-infra` repo/project**; stage isolation via
  `shared/db/wobblio_<stage>`; `shared/db/wobblio` with no suffix = PROD — never touch).
- **IaC:** CDK in `Source/infra/` (NOT under backend): Db/Auth/Storage/Config/Observability/
  Backend/Web/AdminCert/**DataAiPipeline** (renamed from AgenticPipeline) stacks; cdk-nag gates.
  Migrations also in `Source/infra/src/migrations/` (~70, node-pg-migrate).
- **Web:** Next.js **OpenNext SSR on Lambda/CloudFront** (not static export, whatever docs say).
  **Admin:** separate Next.js app `Source/admin/` → `admin.wobblio.com`, NextAuth on the same
  Cognito pool with the role read from the **DB**.
- **Mobile:** Flutter (`Source/mobile/`), BLoC + ports/adapters, fvm, real and active (16a/b/f ✅,
  16c–e 🚧, 17a ✅, 18a–d,f ✅ in the working tree).
- **AI:** Bedrock Converse; model IDs are SSM params per role (vision/auxiliary/insight/embedder/
  **pdf_parser** — exclusive, no fallback). Anthropic in eu-west-1 requires `eu.` inference-profile
  ids. Two ingestion pipelines coexist: LEGACY worker and the agentic (Strands-style coordinator)
  worker behind a runtime SSM toggle + confirm-time dynamic queue routing (NF-01).

## The 12 invariants — where each is actually enforced

1. **RLS tenant isolation** — GUC `app.current_tenant_id` (NOT `current_user_id`):
   `TenantContextAdapter` `set_config(..., true)`; policies in `20260611152000_initial_schema.ts`;
   fail-closed guard in `infrastructure/config/db.ts`; runtime role is non-owner NOBYPASSRLS.
   **Never FORCE RLS** (breaks the single-statement SECURITY DEFINER helpers).
2. **Price store de-identified** — `price_observation` has no tenant/user/invoice/household column,
   no RLS, by schema. Emitted rows are immutable (no back-reference to repair them).
3. **Hexagonal** — validator script, exit 0 required; 849-test unit suite with 99% branch gate
   (currently failing at 98.35% on the working tree).
4. **Stripe web-only** — trivially true: there is **no real Stripe at all yet**, only
   `MockBillingGatewayAdapter` + SSM email whitelist (see 05a; biggest status-table lie).
5. **Role writes** — Stripe-webhook upgrade (mock) + audited admin endpoint
   (`admin_set_user_role` SECURITY DEFINER) + operator scripts. No downgrade path exists yet.
6. **Quotas** — **credit/token-based** (NF-02), not invoice counts: presign checks, worker charges
   actual all-model tokens whenever a model ran (incl. unreadable verdicts and SUSPECTED_DUPLICATE);
   refunds decommissioned. `QuotaService` + `UploadAllowanceResolver`; household pool follows the
   OWNER's role cap.
7. **Idempotent ingestion** — ledger `ON CONFLICT DO NOTHING` first write; SHA-256 same-tenant
   reject at confirm (spans household).
8. **Catalog quorum** — serving gates on `quarantined = false` + `HAVING COUNT(*) >= k` (3) at
   read time (`PriceTrendQueryAdapter`), NOT on product.status; approve releases quarantine.
9. **Narrow encryption** — KMS envelope via `IKmsEncryption` on share tokens, household invites,
   split participant names. `invoice_feedback.comment_enc` is schema-only (no comment capture yet).
10. **Presign ≤300s** — `MAX_TTL_SECONDS = 300` clamp in `S3FileStorageAdapter`.
11. **GDPR deletion** — NOT built (14c/d). Built: export (14b, uncommitted), price-optout write
    path (14a), 18-month image + 7-day export S3 lifecycles, retention crons.
12. **Prompt discipline** — XML-tag prompts in `src/prompts/` (versioned), `callJsonWithRetry`
    (one retry with echoed validation errors → DLQ).

## True build status (2026-07-02)

Shipped & live on dev: 00–04, 06–10, 12 (as `admin-console/00–08` + NF panels), 15, 16a/b/f, 17a,
NF-01 (01–07), NF-02 (01–04, 06–07), price-trends-revamp (A–D). **05 = mock billing only.**
In flight (uncommitted): 14a/14b, agentic stage instrumentation + admin stage-health, mobile
18a–d/f. Open: 05 real Stripe, 11d, 13 hardening items, 14c–e, 16c–e acceptance, 16g/16h, 17b–e,
18e/g/h, NF-02 05, NF-03. Two parked drafts in `specs/mvp/draft/` (abuse handling, multilingual).

## Landmines & operational gotchas (each cost someone time)

- **Deploy/migrate identity:** deploy.sh migrates as the RLS-bound runtime role; anything needing
  table ownership (SECURITY DEFINER fns) must run as `wobblio_dev_app`. `DATABASE_URL` needs
  `uselibpqcompat=true&sslmode=require`. Dev RDS IS reachable locally.
- **Stacks:** ConfigStack deploys before backend; DataAiPipeline stack deploys after Backend (its
  queue URLs are read from SSM at request time, not env). Old `WobblioAgenticPipelineStack` must be
  `cdk destroy`ed, not renamed in place. Legacy ingestion queue deliberately stays in BackendStack.
- **SSM fails closed:** `SsmUploadQuotaAdapter` 500s on ANY missing `/quotas/*` param — seed every
  role × counter. Config is stage-scoped `/wobblio/config/<stage>/*` in AWS but flat locally;
  `ops/email` + `ai/*` still flat.
- **Model roles drift in 3 places:** hardcoded api-handler IAM model list (miss → all-or-nothing
  403), manual SSM params per stage, `Record<ModelRole>` literals. `pdf_parser` unset = worker
  dies at init.
- **Manual (not CDK) resources:** SNS platform apps + `push/*_platform_arn` SSM params (runbook in
  WobblioBackendStack); Bedrock model-id params; Cognito managed-login branding per client.
- **Crons are disabled in non-prod by `makeCron`** — dev KPI dashboards go empty unless a cron is
  force-enabled (IngestionMetricsRollupCron already is).
- **PG class-23 errors fast-fail** the worker (mark FAILED, no retry) — new enum values need their
  CHECK-constraint migration shipped with the code.
- **README's API base for mobile is wrong** — use the execute-api URL (`api.dev.wobblio.app`
  doesn't resolve); Android emulator needs specific dart-defines (see memory/mobile runbook).
- **webapp session.user.id = Cognito sub, not app_user.id** — match by email.
- **Local dev:** LocalStack for AWS but **real Bedrock** (dev model ids); cdklocal needs
  AWS_ENVAR_ALLOWLIST for region; keep local and AWS on identical code paths (no webapp→DB
  shortcuts). rtk proxies dev CLI commands; `rtk proxy <cmd>` bypasses its filtering.

## Firm decisions — do not casually re-litigate

- **No `app.bypass_rls`, ever.** Cross-tenant admin ops = thin single-statement SECURITY DEFINER
  only, no logic in SQL. Admins never see other users' invoice content; the one exception
  (debug-sample zip) ships dark behind `DEBUG_SAMPLE_ENABLED` pending DPO/counsel sign-off.
- **DB is the only store for name/role/status/onboarded** — no Cognito custom/standard profile
  attributes, sessions DB-sourced at sign-in; `onboarded` canonical in `app_user.onboarded_at`.
- **No EMF custom metrics** — plain structured logs + nightly Logs Insights → `kpi_daily`.
- **Charge by timing** (NF-02): model ran ⇒ charge, even unreadable/duplicate; system-fault ⇒
  quarantine + reprocess-on-behalf, never charge. Refund SSM decommissioned.
- **Pack price is the primary price signal**; never gate emission/serving on per-unit price
  (size absent on ~96% of receipts). All size *inference* was reverted (price-trends-revamp).
- **Corrected invoices emit `USER_CONFIRMED` at emission; emitted AUTO rows are never repaired**
  (invariant #2 boundary, locked in 16e).
- **Country-agnostic always** — ISO 3166-2 + DB reference tables, no NL hardcoding (user operates
  in 13 countries). No per-brand venue tags; brand-identity tags are deterministic-only.
- **Shopping lists are per-user, not household-scoped.** Household uploads are auto-stamped
  server-side; pool only applies at ≥2 members.
- **Incremental sub-spec + living `00-handoff.md` workflow** — one slice at a time, update the
  tracker, clear context between slices. The handoffs (11, 14, 16, 18, NF-01, NF-02) are the most
  reliable documents in the repo; the README table and flat epic specs are the least.

## Admin-console spec locations — final state

`specs/mvp/admin-console/00–08` is **authoritative** (shipped with the implementation, commit
`119a26ef`), plus panels owned by NF-01/NF-02 specs (faults, users, pipeline-toggles,
troubleshooting). `specs/mvp/12-admin-console/12a–12g` is a never-built earlier draft →
archive per [admin-console/09](../mvp/admin-console/09-admin-spec-consolidation.md).
`specs/mvp/12-admin-console.md` is a stale index → rewrite as a pointer. Known deviation: admin
auth is NextAuth + DB role, not the `custom:role` claim sub-spec 00 described.
