# 11a — FX Pipeline (Multi-Currency Harmonization)

Parent: [11](../11-bill-splitting-fx-reporting.md) · Handoff: [11-00](./11-00-handoff.md)

## Goal

Populate `fx_rate` daily from ECB, and at ingestion time harmonize every invoice into the user's
`home_currency` (`invoice.total_home_currency` + `invoice.fx_rate_used`). All reports/budgets read
`total_home_currency`; `fx_rate_used` preserves the transaction-date rate forever.

## What already exists

- `fx_rate(date, base, quote, rate)` table (no RLS — global).
- `invoice.total_home_currency` + `invoice.fx_rate_used` columns (never written today).
- `cron-fx-rate-fetch` Lambda (stub) + `FxRateFetchCron` EventBridge rule (prod-only) in
  `WobblioBackendStack.ts`.
- `app_user.home_currency` (default `'EUR'`), read today by `ContributorContextRepositoryAdapter`.

## Design

New hexagonal family `fx/`. ECB publishes **EUR-base** rates only (`1 EUR = rate × quote`).

**Ports** (`src/core/ports/fx/`):
- `IFxRateRepository`
  - `upsertDaily(date: string, base: string, rows: { quote: string; rate: number }[]): Promise<number>`
  - `latestOnOrBefore(quote: string, onDate: string): Promise<number | null>` — EUR→quote rate for the exact date, else the latest strictly prior (spec fallback). `EUR` returns 1 without a query.
- `IEcbRateSource`
  - `fetchDaily(): Promise<{ date: string; rows: { quote: string; rate: number }[] }>` — keeps HTTP/XML out of core.

**Services** (`src/core/services/fx/`):
- `CurrencyHarmonizationService(fxRates: IFxRateRepository)`
  - `harmonize(amount, fromCurrency, homeCurrency, onDate): Promise<{ totalHomeCurrency: number | null; fxRateUsed: number | null }>`
  - `from === home` → `{ amount, 1 }`. Otherwise cross via EUR:
    `fxRateUsed = rate(EUR→home) / rate(EUR→from)`; `totalHomeCurrency = round(amount × fxRateUsed, 2)`.
    Any missing rate → `{ null, null }` (ingestion must never fail on FX; reporting falls back to source amount).
- `FetchDailyFxRatesService(ecb: IEcbRateSource, fxRates: IFxRateRepository)`
  - `run(): Promise<{ upserted: number; usedFallback: boolean }>` — fetch with up to 3 attempts;
    on exhaustion return `{ 0, usedFallback: true }` (no write — yesterday's rows remain the fallback).

**Adapters** (`src/infrastructure/adapters/fx/`):
- `EcbRateSourceAdapter` — `fetch()` (global, Node 24) GET `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`; parse the fixed `<Cube time=...>` / `<Cube currency=.. rate=..>` format by regex (no new dependency). No API key.
- `FxRateRepositoryAdapter(client)` — pg upsert `ON CONFLICT (date, base, quote) DO UPDATE SET rate = EXCLUDED.rate`; `latestOnOrBefore` = `SELECT rate FROM fx_rate WHERE base='EUR' AND quote=$1 AND date<=$2 ORDER BY date DESC LIMIT 1`.

**Cron** — rewrite `handlers/cron-fx-rate-fetch/index.ts`: build pool → wire adapters + service →
`run()`; on `usedFallback` log `event: fx_fetch_fallback` at error (backs the CloudWatch alarm).

**Ingestion harmonization** — in `InvoiceFinalizer.finalize` (shared path), before `persistParsed`:
- Add optional `homeCurrency?: string` to `ContributorContext`; `ContributorContextRepositoryAdapter`
  selects `u.home_currency` (already querying `app_user`).
- Inject `CurrencyHarmonizationService` into `InvoiceFinalizer` (4th ctor arg). Compute
  `{ totalHomeCurrency, fxRateUsed }` from `(receipt.total, receipt.currency, context.homeCurrency ?? 'EUR', receipt.transactionDate)`.
- Add `totalHomeCurrency` + `fxRateUsed` (both `number | null`) to `PersistParsedInvoice`; write them
  in `InvoiceRepositoryAdapter.persistParsed`.
- Thread the FX repo through the three finalizer construction sites: `IngestionService` ctor
  (new `fxRates: IFxRateRepository` param → builds the service), `handlers/agentic-worker/index.ts`,
  `src/local/evaluation/processors.ts`. Legacy worker `handlers/ingestion-worker/index.ts` passes
  `new FxRateRepositoryAdapter(client)` into `IngestionService`.

**CDK** (`WobblioBackendStack.ts`):
- Enable `FxRateFetchCron` in all stages (pass `true`, like `IngestionMetricsRollupCron`) so dev's
  `fx_rate` fills. Align schedule to `cron({ minute: '0', hour: '0' })` (00:00 UTC, spec).
- Add a log-based metric filter on the cron's log group for `fx_fetch_fallback` → CloudWatch alarm
  (no EMF; consistent with the project's log-based telemetry posture).

## Checklist

- [ ] `fx/` ports + services + adapters
- [ ] `cron-fx-rate-fetch` handler wired
- [ ] `ContributorContext.homeCurrency` + adapter select
- [ ] `InvoiceFinalizer` harmonize + persist; `PersistParsedInvoice` + adapter columns
- [ ] Three finalizer construction sites + legacy worker wiring updated
- [ ] CDK: FX cron all-stages + 00:00 UTC + fallback alarm
- [ ] Unit: `CurrencyHarmonizationService` (identity, EUR↔X, X↔Y cross, missing-rate → null), `FetchDailyFxRatesService` (retry, fallback signal)
- [ ] Integration: `FxRateRepositoryAdapter` upsert + `latestOnOrBefore` fallback; worker harmonization end-to-end

## Verify

- `npm run skill:hexagonal-architecture-validator` (exit 0), `npm run test:unit`, `npm run test:integration`, `npm run validate:security`.
- `cdk synth` passes cdk-nag.
- Manual: invoke cron locally → assert `fx_rate` rows; ingest a non-EUR receipt for a EUR-home user → assert `total_home_currency` + `fx_rate_used` populated.
