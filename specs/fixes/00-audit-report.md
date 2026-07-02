# Wobblio Full-Project Audit — 2026-07-02

Source of truth for this audit: `specs/` (intent) + `Source/` (behavior); the v2.4 doc is
historical. Detail lives in the linked fix specs; this file is the index.

**Working-tree note:** the uncommitted changes are legitimate in-flight work, not drift — three
coherent efforts: Epic 14 GDPR (14a consent-optout + 14b export: worker, queue, SES notice, routes),
NF-01 agentic stage instrumentation + admin stage-health panel, and mobile 18a–18f. Caveat: the
unit suite passes (849/849) but the **99% branch-coverage gate currently fails** (98.35%,
`BillSplitService.ts:60`) — the tree is red on one validation gate.

## Hard-invariant verification (CLAUDE.md #1–#12)

Verified enforced: **#1** (`app.current_tenant_id` GUC, `TenantContextAdapter.ts:10`, fail-closed
guard `config/db.ts`, non-owner NOBYPASSRLS role) · **#2** (`price_observation` schema has no
tenant/user/invoice/household column) · **#3** (validator exit 0) · **#4** (zero purchase code in
mobile) · **#7** (`ingestion_ledger` ON CONFLICT DO NOTHING first write; same-tenant SHA-256 reject
at confirm) · **#8** (k≥3 `HAVING` + `quarantined = false` in `PriceTrendQueryAdapter.ts:49,63`) ·
**#9** (share/invite tokens + split participant names KMS-encrypted; caveat under 07b) · **#10**
(`MAX_TTL_SECONDS = 300` clamp, `S3FileStorageAdapter.ts:12`) · **#12** (XML-tagged prompts +
`callJsonWithRetry` one-retry-with-errors → DLQ).
Not holding as written: **#5, #6** (text stale → [Fix 01](./01-invariant-amendments.md)) · **#11**
(deletion 14c/14d not implemented — export/retention are; highest open compliance item).

## Findings by epic

- **Meta/docs** — [DRIFT] Both CLAUDE.md files claim pre-implementation status; README status
  table wrong on ~10 epics (07 "Next" though shipped; 17/18 absent); README+02b claim static-export
  hosting vs OpenNext SSR reality; GDPR rule names wrong GUC (`app.current_user_id`); NF-00 DI
  prompt never executed. → [Fix 02](./02-docs-truth-realignment.md)
- **05 Billing** — [DRIFT, P1] Marked ✅ Done but the only gateway is
  `MockBillingGatewayAdapter`: no Stripe SDK, no webhook endpoint/signature verification, **no
  downgrade path** (cancel keeps PREMIUM forever), undocumented SSM email whitelist gate.
  → [05a](../mvp/05-billing-stripe/05a-real-stripe-gateway.md)
- **07 Ingestion** — [DRIFT/CONTRADICTION] spec still mandates EMF metrics + `ai_spend_ledger`
  (both deliberately removed), invoice-count quotas (→ credits), duplicate-refund rule reversed by
  NF-02, status machine missing quarantine/reaper/correction states, phantom multi-page checklist
  item → [07a](../mvp/07-core-ingestion-pipeline/07a-spec-realignment.md). [GAP] feedback
  reasons/free-text/`model_ids_snapshot` never implemented (verdict only)
  → [07b](../mvp/07-core-ingestion-pipeline/07b-feedback-capture-completion.md). [GAP] web review
  has no correction UI though the backend (built by 16e) exists
  → [07c](../mvp/07-core-ingestion-pipeline/07c-web-correction-parity.md)
- **08 / NF-01 / NF-02** — mostly healthy (handoffs are the best-maintained docs in the repo).
  [GAP] PDF parses cost-priced at vision-model rates + orphan `admin_pipeline_cost_deficit`
  → [NF-01/08](../non-functional/01-data-ai-pipeline/08-pdf-cost-truth.md). NF-02 05 (churn) open;
  08 (debug-sample) correctly env-gated off pending DPO (`adminFaultRoutes.ts:38`).
- **10** — [DRIFT] "refactor in progress" markers stale (landed `9abb5bc1`); [GAP] 10b's offline
  list sync spec'd, never built (18c shipped online-only) → [Fix 05 §5](./05-mobile-parity-roadmap.md)
- **11** — 11a–11c ✅ (README says ⬜); 11d open; 11c's localStorage split-id workaround should be
  retired by a `GET /invoices/{id}/splits` endpoint when 18h lands → [Fix 05 §3–4](./05-mobile-parity-roadmap.md)
- **12 Admin** — [CONTRADICTION] three spec locations: `admin-console/00–08` = built truth;
  `12-admin-console/12a–12g` = superseded draft (archive); `12-admin-console.md` = stale index
  ("zero /admin routes", dead links) → [admin-console/09](../mvp/admin-console/09-admin-spec-consolidation.md)
- **13 Security** — [CONTRADICTION] spec says 30-min presign vs invariant #10's 300s (code is
  right); [DRIFT] in-VPC posture never adopted (deliberate off-VPC interim), throttle numbers;
  [GAP] no WAF on API Gateway, no admin MFA, no CSP → [13a](../mvp/13-security-controls/13a-posture-realignment-and-hardening.md)
- **14 GDPR** — in-flight, well-run (14a/14b ✅ uncommitted, decisions locked: fresh 300s URL per
  download, no links in email). 14c/14d = invariant #11 → prioritize after commit.
- **16/17/18 Mobile** — 16c–16e 🚧 (on-device acceptance pending); [GAP, P2] **16f pushes deliver
  to zero devices — 16g client not built, mobile never registers tokens**; 17b–17e reskins not
  started; 18e/18g/18h unspec'd → [Fix 05](./05-mobile-parity-roadmap.md)
- **price-trends-revamp** — complete; deploy note stale (Fix 02 §7).

## Fix-spec index (build order within priority)

| P | Spec | Kind |
|---|---|---|
| P1 | [01-invariant-amendments](./01-invariant-amendments.md) | invariant text |
| P1 | [05a-real-stripe-gateway](../mvp/05-billing-stripe/05a-real-stripe-gateway.md) | build |
| P1* | Epic 14c/14d (already spec'd in their epic dir) — invariant #11 | build |
| P2 | [13a-posture-realignment](../mvp/13-security-controls/13a-posture-realignment-and-hardening.md) | build+doc |
| P2 | [05-mobile-parity-roadmap §1 (16g)](./05-mobile-parity-roadmap.md) | build |
| P3 | [07a](../mvp/07-core-ingestion-pipeline/07a-spec-realignment.md) · [07b](../mvp/07-core-ingestion-pipeline/07b-feedback-capture-completion.md) · [07c](../mvp/07-core-ingestion-pipeline/07c-web-correction-parity.md) | doc / build |
| P3 | [NF-01/08 pdf-cost-truth](../non-functional/01-data-ai-pipeline/08-pdf-cost-truth.md) | build |
| P3 | [admin-console/09 consolidation](../mvp/admin-console/09-admin-spec-consolidation.md) | spec hygiene |
| P3 | [03-admin-incident-workflows](./03-admin-incident-workflows.md) [ADMIN] · [04-admin-safety-rails](./04-admin-safety-rails.md) [ADMIN] | build |
| P3 | [05-mobile-parity-roadmap §2–6](./05-mobile-parity-roadmap.md) | build |
| P4 | [02-docs-truth-realignment](./02-docs-truth-realignment.md) | doc |

## Phase 3 — Delight features (leveraging the price-observation moat)

1. **Price-drop watchlist + "buy now" push** — pin products; alert when a fresh k≥3 regional cell
   drops below your own historical average (own-purchase history × observation store × 16f push).
   Extends 08 + 16g. PII-clean: computed per-tenant against aggregate cells.
2. **Personal inflation shield report** — "your basket inflated 1.8% vs 4.1% market" — personal
   CPI from own invoices vs regional basket from the store. Extends 11d reporting; the flagship
   anti-inflation story made personal. Network effect: accuracy scales with contributor density.
3. **Basket time-machine / store scorecard** — re-price last month's actual basket at each nearby
   store: "switching to Jumbo saves €23/mo". Extends 10c optimizer from lists to realized baskets.
   Premium hook.
4. **In-store price confirm at check-off** — checking an item off a list offers a one-tap shelf-price
   confirm feeding `USER_CONFIRMED` observations. Turns every shopping trip into corroboration —
   the strongest flywheel idea here. ⚠ Tension: new emission path must stay de-identified
   (invariant #2) and respect the Sybil/trust gate (`contributor_trust_at_write`); needs its own
   quorum treatment so it can't poison cells cheaply. New sub-spec under 08.
5. **Deal-aware budget protection** — at 85% budget alert, auto-suggest the cheapest-store
   re-route for the remaining planned list (10a alerts × 10c optimizer × 10d advisor copy).
   Extends existing epics; no new data surface.
6. **Discount-truth detector** — `was_discounted` exists per observation; flag promos priced at or
   above the 30-day median ("fake deal") on trends + list pricing. Pure aggregate, very
   differentiating, near-zero infra.
7. **Coverage map / contribution gamification** — Eindhoven heat map of cell freshness (k-counts
   only); "your scans unlocked 3 products this week". Drives density where the engine needs it.
   ⚠ render aggregates only, never per-user pins.
8. **Replenishment lists** — infer purchase cadence from own history ("milk every 6 days"),
   one-tap generate a pre-priced list routed via 10c. Personal-data-only (RLS-scoped), extends 10b.

## Phase 4 — Admin console improvements (operator tooling)

Fully specified in [03-admin-incident-workflows](./03-admin-incident-workflows.md) and
[04-admin-safety-rails](./04-admin-safety-rails.md); headlines: single-invoice pipeline drill-down;
stuck-PROCESSING triage + manual reaper; **intraday** Bedrock-spend panel next to the kill-switch
(kpi_daily is nightly — a runaway burns unseen for 24h); stale-PROVISIONAL catalog-limbo queue;
GDPR ops view post-14; typed confirmations on DLQ bulk ops + IAM-validated model swaps;
revert-from-audit-log for SSM/model changes; audit-log browser; admin MFA; last-ADMIN lockout
guard. GDPR boundary re-verified: no admin view returns user invoice content; debug-sample stays
flag-gated off pending DPO.
