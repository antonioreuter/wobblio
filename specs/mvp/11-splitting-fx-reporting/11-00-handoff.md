# 11 — Bill Splitting, FX & Reporting — Living Handoff

Tracks the incremental implementation of `specs/mvp/11-bill-splitting-fx-reporting.md`, decomposed
into sub-specs. Update this file as each sub-spec lands; clear context between sub-specs.

## Why decomposed

The flagship **3-product/6-month comparison chart is already built** end-to-end
(`GET /price-trends/comparison`, `PriceTrendQueryAdapter` with k≥3 + quarantine + discount-split +
staleness, `OwnPurchaseHistoryQueryAdapter`, reports page UI). Dashboard stat cards are computed
client-side from workspace data. So spec 11's genuinely-missing work is **FX harmonization**, **bill
splitting** (greenfield), and a few **reporting drill-down endpoints** — split below.

## Decisions (locked)

- **Fee pool derivation (splitting):** no dedicated tax/tip/service field exists on `invoice`.
  `feePool = invoice.total − Σ(line_total of product lines, excluding is_discount / is_deposit_or_fee)`,
  allocated proportionally to each participant's subtotal share. Spec-faithful ("printed totals at
  all times, never re-derived from rates").
- **Mobile UI deferred to epic 16** (Flutter). This epic ships backend + web only.
- **FX cross-rate:** ECB publishes EUR-base only. Convert X→Y via EUR:
  `rate(X→Y) = rate(EUR→Y) / rate(EUR→X)`; EUR legs = 1. `fx_rate_used` stores the effective X→Y
  rate for permanent historical honesty.

## Sub-specs & status

| Sub-spec | Scope | Depends | Status |
|---|---|---|---|
| [11a](./11a-fx-pipeline.md) | ECB daily FX cron + ingestion currency harmonization | — | ✅ code complete (2026-07-01) — integration run pending local stack |
| [11b](./11b-bill-splitting-backend.md) | Bill-split domain + endpoints + WhatsApp export (Premium) | — | ✅ code complete (2026-07-01) |
| [11c](./11c-bill-splitting-web-ui.md) | Web bill-split panel + WhatsApp copy | 11b | ⬜ not started |
| [11d](./11d-reporting-endpoints.md) | `/reports/*` overview + drill-down + personal price history | — | ⬜ not started |

DAG: **11a · 11b → 11c · 11d** independent. Recommended order: 11a → 11b → 11c → 11d.

## Already built — do NOT rebuild

- `bill_split` + `bill_split_line` tables **with RLS** (`Source/infra/src/migrations/20260611152000_initial_schema.ts:289-301, 393-404`).
- `invoice.total_home_currency` + `invoice.fx_rate_used` columns + `fx_rate(date,base,quote,rate)` table (same migration). Columns currently never written.
- `FxRateFetchCron` EventBridge rule + `cron-fx-rate-fetch` Lambda already declared in `WobblioBackendStack.ts` (currently prod-only, stub handler).
- `IKmsEncryption` + `KmsEncryptionAdapter`/`LocalEncryptionAdapter` + `encryptionFactory` (pattern: `ShareInvoiceService`, `HouseholdInviteService`).
- Comparison chart + own-purchase history (`PriceTrendService`, adapters, reports page).

## 11a — done (2026-07-01)

- New `fx/` family: ports `IFxRateRepository`, `IEcbRateSource`; services `CurrencyHarmonizationService`, `FetchDailyFxRatesService`; adapters `FxRateRepositoryAdapter`, `EcbRateSourceAdapter` (regex-parses ECB XML, no new dep, uses Node 24 global `fetch`).
- `cron-fx-rate-fetch` handler wired; logs `fx_fetch_fallback` (error) after 3 failed ECB attempts.
- Harmonization threaded through `InvoiceFinalizer` (4th ctor arg = `CurrencyHarmonizationService`); `PersistParsedInvoice` + `InvoiceRepositoryAdapter.persistParsed` now write `total_home_currency` + `fx_rate_used`. `ContributorContext` gained optional `homeCurrency` (adapter selects `app_user.home_currency`). Three construction sites updated: `IngestionService` ctor (new `fxRates` param), `handlers/agentic-worker`, `src/local/evaluation/processors.ts`; legacy worker passes `FxRateRepositoryAdapter`.
- CDK: `FxRateFetchCron` now all-stages + 00:00 UTC; new `FxRateFallbackMetricFilter` + `FxRateFetchFallbackAlarm` → ops SNS topic (backend stack now takes `observabilityStack` prop, wired in `bin/wobblio.ts`).
- Gates green: `npm run build`, hexagonal validator (exit 0), `test:unit` (782 pass, coverage OK), `validate:security`, `cdk synth WobblioBackendStack-dev` (cdk-nag clean).
- **Pending:** integration tests (`FxRateRepository.local.test.ts` + the two `IngestionPipeline.local.test.ts` persist edits) need the local Postgres/LocalStack stack up (`deploy-local.sh` / `local-aws-simulator`) — not run yet (localhost:5432 was down).
- **Verify manually on deploy:** invoke `cron-fx-rate-fetch` → assert `fx_rate` rows; ingest a non-EUR receipt for a EUR-home user → assert `total_home_currency` + `fx_rate_used` populated.
- Integration since verified: `FxRateRepository.local.test.ts` + `IngestionPipeline.local.test.ts` (incl. a new cross-currency harmonize→persist case) pass against local Postgres.

## 11b — done (2026-07-01)

- New `splitting/` family: domain `core/domain/billSplit.ts` (`computeSplitSummary`, pure); port `IBillSplitRepository`; service `BillSplitService` (KMS encrypt/decrypt of participant names); adapter `BillSplitRepositoryAdapter` (pg, `ON CONFLICT (split_id,line_id) DO UPDATE`). Errors `BillSplitNotFoundError` (404) + `InvalidSplitError` (400) added to `core/domain/errors.ts`.
- **Implicit-owner rule (locked):** unassigned product-line remainder → the account holder ("You" bucket), so `Σ participant totals === printed invoice total` always, even mid-assignment. `assignableSubtotal = Σ non-discount/non-deposit line_total`; `feePool = invoiceTotal − assignableSubtotal` spread by subtotal share; rounding residual reconciled onto the largest share.
- 6 endpoints in `handlers/api-handler/splitRoutes.ts`, delegated from `handleInvoicesRoute` on `^/invoices/{id}/splits`. **Premium hard-gate** (403 for STANDARD; PREMIUM/TESTER/ADMIN allowed). `assignLine` rejects non-product (discount/deposit) lines and fraction ∉ (0,1]; missing fraction defaults 1.0.
- `InvoiceDetailLine` extended with `isDiscount`/`isDepositOrFee`; `InvoiceRepositoryAdapter.getDetail` now selects both (needed by the splitter to exclude fee-pool lines).
- WhatsApp export uses the **invoice's own currency symbol** (EUR€/GBP£/USD$, else code prefix) — country-agnostic, not hardcoded €.
- Gates green: hexagonal validator (exit 0), `test:unit` (800 pass, +18 new domain/service), `BillSplit.local.test.ts` integration (adapter CRUD + encryption round-trip under RLS), `validate:security`, `tsc --noEmit`. (Pre-existing local-stack integration failures in BillingService/DataIntelligence are unrelated env/schema drift — need full `deploy-local`.)
- **Next:** 11c (web bill-split panel, depends on 11b) · 11d (`/reports/*` endpoints, independent).

## Notes / landmines

- `makeCron` in `WobblioBackendStack.ts` disables crons in non-prod. FX cron must be force-enabled
  in all stages (like `IngestionMetricsRollupCron`) or `fx_rate` stays empty in dev.
- Ingestion persist/emit lives in `InvoiceFinalizer.finalize` (shared by legacy + agentic + eval
  pipelines) — three construction sites to update when threading the harmonizer.
