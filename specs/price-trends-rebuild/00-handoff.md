# Price-Trends Rebuild — Handoff / Context Carry-Over

> Living doc. Update the **Status** + **What changed last** + **Next** sections at the END of
> each sub-spec so a fresh context window can resume without losing state.

## Goal

Make the price-trends report (`/reports`, `GET /price-trends/comparison`) tell the truth about
**time** and always **visibly draw** whatever data exists.

Four consecutive epics shipped correctly against their own briefs — `specs/price-trends-revamp/`
(A–D), `specs/price-trends-gaps/` (01–04), `specs/fixes/09-*`, and fix 10 (never specced) — but every
one of them extended the same two untested files: `buildChart()` inside `reports/page.tsx`
(751 lines, zero tests) and `line-chart.tsx` (zero tests). The serving engine underneath is sound;
the **presentation primitive** was never fixed. This series fixes it, plus the own-history
correctness bugs that make the legend lie, and leaves regression tests so the next epic can't
quietly break it again.

Owner report of the symptom: *"when we select just one item, the chart is not drawing."* Confirmed —
three independent causes, see F1/F2/F4 below.

## Locked decisions

- **Gap rendering: marker + faint dotted connector.** A marker at every observed week; a solid line
  between consecutive weeks; a faint dotted connector across gaps. A two-purchase item still reads
  as a trend, while the dotted style makes the absence of data visible. **Never** a solid line
  across a gap — that would assert a price path nobody observed.
- **Backend changes are purely additive.** `specs/price-trends-gaps/00-handoff.md` declares
  `currency`, `ownHistory[].lastPrice/previousPrice` and `regionMerchantCount` un-renameable, and the
  Next.js API routes under `src/app/api/price-trends/` are verbatim proxies with no BFF shim to
  absorb a break. New fields only.
- **Axis span = first→last observed week across the visible series, clamped to the selected range** —
  not the full range. This restores true relative spacing between observations without a wall of
  dead space when someone picks "Last 6 months" and has three recent purchases.
  *(Rejected: always span the full range — squashes real data into the right edge.)*
- **Series colour is keyed to the product's position in the selection**, so a product keeps its hue
  when the compare mode is toggled.

### Explicitly unchanged (do not touch here)

Per `specs/price-trends-gaps/00-handoff.md` and `specs/fixes/09-*/00-handoff.md` "blast radius":
k≥3 read-time quorum gate · 60-day staleness threshold · 26-week window · weekly medians ·
discount separation (§6.5.1) · pack-price as the sole price signal (fix 09 DEC-1) · per-merchant
product identity (DEC-2) · the 09/05 comparability rule · no FX conversion (currency honesty only) ·
**no merchant drill-down** (that belongs to a different report).

## Blast radius (verified 2026-07-24)

- **Mobile is safe.** `Source/mobile/` deleted its price-trends client in epic 19
  (`specs/mvp/19-mobile-2a-full/19-00-handoff.md`) — `price_trend_comparison.dart`,
  `IPriceTrendRepository`/`HttpPriceTrendRepository` and `TrendLineChart` are gone; the mobile
  reports screen is now the personal-inflation CPI view. Nothing in Dart decodes this contract.
- **Only one webapp tree** calls `usePriceTrends`: `src/app/(app)/reports/page.tsx` and its children.
- `CounterpartSuggestionService` imports `SeriesSize` and `TREND_WINDOW_WEEKS` — **type-only**
  coupling, unaffected by additive fields.
- The shopping-list optimizer shares fix-09/10 *vocabulary* (`ComparabilityReason` values
  `comparable|watch_only|ambiguous|no_link`, `ownHistoryBasket`) across the webapp **and** Flutter
  (`Source/mobile/lib/core/lists/optimization_result.dart`). Do not rename those strings.

## Defect register (verified in code, 2026-07-24)

Reproduction of F1/F2 was by rendering `LineChart` directly with realistic props:

| Input | Actual SVG output |
|---|---|
| 1 observed week, 1 series | `0 polylines`, `1 circle r=2.5` — a ~5px speck |
| all purchases discounted (`median` null, `discountMedian` set) | `0 polylines`, `0 circles`, 2 hollow diamonds |

### Frontend (`Source/webapp`)

| # | Defect | Evidence | Sub-spec |
|---|---|---|---|
| F1 | **Single observed week draws a 2.5px dot** — no line, no label. This is the *normal* case for one selected product, not an edge case. | `line-chart.tsx:80-81` | 02 |
| F2 | **Promo-only series draws nothing but diamonds.** `buildChart` keeps a series whose `data` is all-null when `discounts` has values, but the renderer only strokes `segments(s.data)`. Legend then shows `—`. Common on NL receipts (BONUS lines). | `page.tsx:743-745`, `line-chart.tsx:78-96` | 01, 02 |
| F3 | **X-axis is not a time axis.** It is the union of weeks that happen to have data, so empty weeks don't exist on it. Two purchases 5 months apart render adjacent, joined by a straight line. For a single series `data` can never contain `null`, making `segments()` and its "line breaks on missing weeks" comment dead code in the default mode. | `page.tsx:679-683` | 01 |
| F4 | **Missing `regionCode` → no request at all**, and the empty state falsely blames missing scans. `TrendSuggestions` goes silent for the same reason. | `use-price-trends.ts:106`, `page.tsx:523`, `trend-suggestions.tsx:40` | 03 |
| F5 | **Own series hardcodes `stale: false`** — a product last bought 5 months ago never greys. Violates §6.5.2 freshness honesty. | `page.tsx:731` | 04, 05 |
| F6 | **Legend headline silently swaps metrics** — `s.lastPrice ?? rangeMedian` falls back from a window-wide last-paid price to a range median without saying so. | `page.tsx:617` | 05 |
| F7 | **A product hidden by the date range gets no chip note** — it just vanishes. Diagnostics cover backend reasons only. | `page.tsx:454-458` | 01, 05 |
| F8 | **Range maths is off.** `daysBack()` carries the current time-of-day and is compared against UTC-midnight week starts; and filtering is on the week *start*, so a week holding in-range data is dropped whole. | `trend-data.ts:66-72` | 01 |
| F9 | **Series colour is indexed per-mode**, so a product changes colour when you toggle My prices ↔ Local market. | `page.tsx:703` vs `:727` | 01 |
| F10 | **All chart-building logic lives untested inside a 751-line page component** — `buildChart`, `diagnosticNote`, `buildSizePrompts`, `sizeChip`. This is *why* F1–F9 shipped. | `page.tsx` | 01, 06 |

### Backend (`Source/backend`)

| # | Defect | Evidence | Sub-spec |
|---|---|---|---|
| B1 | **Size chip can mix two rows.** `pack_quantity` and `base_unit` come from two independent `array_agg`s ordered by `(pack_quantity IS NOT NULL) DESC, transaction_date DESC` — not a total order. On a date tie they can be read from different lines, yielding e.g. "500 L". The comment directly above claims the opposite guarantee. | `OwnPurchaseHistoryQueryAdapter.ts:86-87` | 04 |
| B2 | **`purchaseCount` counts lines in the 26-week window.** Bought 5× last year and once last week → count 1 → *"First purchase — we'll track this for you"*. Two lines of one product on one receipt also count as two purchases. | `OwnPurchaseHistoryQueryAdapter.ts:85`, `trend-data.ts:48` | 04 |
| B3 | **Own-history lines carry no staleness**, unlike market lines which go through `decorate()`. | `PriceTrendService.ts:176-179` | 04 |
| B4 | **Unit-test fixtures are stale and nobody noticed.** `line()` omits the required `size`/`ambiguous`; `ownLine()` still carries a removed `unit` field. Silent because `tsconfig.json` excludes `**/*.test.ts` and Vitest does not typecheck. | `src/tests/unit/core/services/data-intelligence/PriceTrendService.test.ts:24-38` | 06 |
| B5 | **The size-chip path is untested at every tier.** `OwnPurchaseHistory.local.test.ts`'s `insertLine()` never sets `pack_quantity`/`base_unit`/`size_source`, so everything resolves to NULL. | `src/tests/integration/OwnPurchaseHistory.local.test.ts` | 06 |

### Documentation

| # | Defect | Sub-spec |
|---|---|---|
| D1 | `specs/mvp/18-mobile-navigation-and-lists/18e-reports.md` still ticks every box for a mobile price-trends client that epic 19 deleted — it reads as current state and misleads. | 07 |
| D2 | **Fix 10 has no spec file anywhere.** Its contract (silent `product_link`, counterpart suggestion chips, the empty-chart diagnostics union) lives only in commit `d3afe404`'s message and code doc-comments. | 07 |
| D3 | `specs/price-trends-gaps/00-handoff.md` leaves the `amendment` box unticked although `docs/amendments/2026-07-05-own-history-window-all-tiers.md` exists. | 07 |

## Sub-specs

| # | Title | Layer | Fixes |
|---|---|---|---|
| 01 | Honest week axis | webapp (pure logic) | F3, F7, F8, F9, F10, part of F2 |
| 02 | Chart primitive | webapp (render) | F1, F2 |
| 03 | Region gating & empty states | webapp | F4 |
| 04 | Own-history truth | backend (additive) | B1, B2, B3, F5 |
| 05 | Legend honesty & diagnostics | webapp | F5, F6, F7 |
| 06 | Regression tests | both | F10, B4, B5 |
| 07 | Spec & doc realignment | docs | D1, D2, D3 |

Order: **07 → 01 → 02 → 03 → 04 → 05 → 06.** 01+02 alone fix the reported symptom and are
independently shippable. 05 depends on 04.

## Status

**ALL SUB-SPECS IMPLEMENTED 2026-07-24/25 — local, uncommitted, not deployed.**

- [x] 07 — spec & doc realignment
- [x] 01 — honest week axis
- [x] 02 — chart primitive
- [x] 03 — region gating & empty states
- [x] 04 — own-history truth
- [x] 05 — legend honesty & diagnostics
- [x] 06 — regression tests

## What changed last (01–06)

**01 — honest week axis.** New `trend-chart-model.ts` holds `buildTrendChart`, `ChartSeries`,
`sizeChip`, `diagnosticNote`, `marketDiagnosticNote`, `buildSizePrompts`, `pairKey`, `OWN_LABEL`;
`reports/page.tsx` dropped from 751 lines to composition + state. `trend-data.ts` gained
`mondayOf`, `resolveWeekRange`, `weekInRange`, `buildWeekAxis`, `WeekRange`; `inRange` and
`daysBack` were **deleted** and `widenRangeIfHidden` re-based on the new helpers. Series carry
`hasRegular`/`hasPromo`. Colour is `seriesColor(selectedIndex * 3 + merchantOrdinal)`.

**02 — chart primitive.** `line-chart.tsx` now renders per-series `Track`s: solid runs over
consecutive weeks, `.chart-gap` dotted connectors across holes, `.chart-point` markers (r=3.5,
`--bg-color` halo) on every observed week, a `.chart-point-label` value beside a lone observation,
and a real promo track (`.chart-promo-link` + diamonds) so a promo-only series draws. Adaptive
x-labels (`ceil(n/8)`), descriptive `aria-label`. Four new CSS rules in `workspace.css`.

**03 — region gating.** `regionMissing` state in `reports/page.tsx` →
`data-testid="trends-region-required"` with a button that opens the picker;
`region-picker.tsx` gained optional controlled `open`/`onOpenChange` plus an effect that syncs the
drafts whenever it opens (`expand()` removed). No mandated empty-state copy was altered.

**04 — own-history truth.** `OwnPurchaseHistoryQueryAdapter`: `size_pick` CTE
(`DISTINCT ON (product_id) … ORDER BY product_id, transaction_date DESC, line_id DESC`) replaces the
twin `array_agg`s; `purchaseCount` is `COUNT(DISTINCT invoice_id)`; new `prior` CTE →
`priorPurchaseExists`. `PriceTrendService` gained `decorateOwn` + exported `ServedOwnPurchaseLine`.
The stale class comment claiming a per-unit price was corrected. Webapp `personalHistory()` treats
`priorPurchaseExists` as disqualifying `first`.

**05 — legend honesty.** The `s.lastPrice ?? rangeMedian` fallback is gone (shows `—`). Own series
carry real staleness — rendered as `last bought {date} · stale` in the existing chip rather than a
second badge. Chip notes merge backend diagnostics with the client-side `hidden` reasons. New
"Gaps in the line" point in `price-trends-help.tsx`.

**06 — tests.** New `trend-chart-model.test.ts` (17), `line-chart.test.tsx` (11),
`reports/page.test.tsx` (5), `src/test/e2e/price-trends.spec.ts` (1, green against the local stack),
plus `setRegion`/`seedOwnPurchase`/`deleteProduct` helpers in `src/test/e2e/helpers/db.ts`.
`PriceTrendService.test.ts` fixtures fixed (B4) + 3 new cases; `OwnPurchaseHistory.local.test.ts`
gained size/tie and prior-purchase cases (B5) and its `insertLine` now accepts an explicit id plus
`packQuantity`/`baseUnit`/`sizeSource`.

## Gate results (2026-07-25)

| Gate | Result |
|---|---|
| `skill:hexagonal-architecture-validator` | exit 0 |
| backend `test:unit` | 140 files / 1078 tests pass; coverage 99.9 / 99.13 / 100 / 99.9 |
| backend `validate:security` | pass (3 pre-existing GDPR-export presign warnings, untouched) |
| backend `test:integration` — price-trends files | `OwnPurchaseHistory` 8/8, `PriceTrendQuery` + `CounterpartSuggestions` 9/9 |
| webapp `tsc --noEmit` | clean |
| webapp eslint (changed files) | clean |
| webapp `test:unit` | 37 files / 218 tests pass |
| Playwright `price-trends.spec.ts` | pass against the local stack |

## Known-red, NOT caused by this series

- `InvoiceRepositoryAdapter.getDetail` throws `missing FROM-clause entry for table "p"`:
  `LIST_COLUMNS` embeds `PROCESSING_STAGE_COLUMN` (which references `p.stage`) but `getDetail`'s
  FROM clause omits `PROGRESS_JOIN`. This is the **in-flight ingestion-progress work**
  (`invoice_processing_progress`, migration `20260724090000`) being developed concurrently in the
  same working tree. It reddens `IngestionPipeline.local.test.ts`, `BillSplit.local.test.ts`, and
  the bill-split/household E2E specs. **Do not fix it from this series** — it belongs to that change.
- `BillingService.local.test.ts` × 2: `ParameterNotFound: /wobblio/config/billing/mock_premium_whitelist`
  — LocalStack SSM was never seeded (`docker compose up` without `make bootstrap`/`make deploy`).
  Environment, not code.
- **Pre-existing E2E infra defect:** `src/test/e2e/helpers/db.ts` exports a module-level `pool` that
  every spec's `afterAll` ends via `closeDb()`. With `fullyParallel: true`, two spec files sharing a
  worker make the second one fail with *"Cannot use a pool after calling end on the pool"*. It
  predates this series (reproducible with `--grep-invert "price trends"`); the real fix is a
  Playwright global teardown, which is out of scope here.

## Next

1. **Move to a git worktree before committing** — this tree also carries another session's
   uncommitted ingestion-progress work (see above). Commit only the price-trends paths.
2. Deploy dev: `cd Source/infra && STAGE=dev npm run cdk:deploy:backend && STAGE=dev npm run cdk:deploy:web`.
3. Walk the seven manual checks in `06`'s "Done when" against dev data.

## Contract ledger

`GET /price-trends/comparison` — already shipped (do **not** rename):

| Field | Added by |
|---|---|
| `currency` (top level, ISO-4217, nullable) | gaps/02 |
| `ownHistory[].lastPrice`, `ownHistory[].previousPrice` | gaps/03 |
| `regionMerchantCount` (top level) | gaps/04 |
| `lines[].size`, `lines[].ambiguous`, `ownHistory[].size` | fix 09/01 + 09/05 |
| `diagnostics[]` (`ProductDiagnostic` with the `MarketDiagnostic`/`OwnDiagnostic` unions) | fix 10 |

Added by **this** series (sub-spec 04, additive):

| Field | Meaning |
|---|---|
| `ownHistory[].stale` (boolean) | no own purchase in `TREND_STALE_DAYS` (60) |
| `ownHistory[].staleDays` (integer) | age in days of `lastPurchasedOn` |
| `ownHistory[].priorPurchaseExists` (boolean) | the caller bought this product **before** the 26-week window — disqualifies the "First purchase" copy |

`ownHistory[].purchaseCount` changes **semantics** (not name): distinct invoices in the window,
not invoice lines. This is a bug fix, not a contract break — see B2.

## Validation gates

Backend (04, 06):
- `cd Source/backend && npm run skill:hexagonal-architecture-validator` — exit 0
- `cd Source/backend && npm run test:unit` — coverage thresholds are **lines 99 / functions 100 /
  branches 99** over `src/core/**`, so every new branch needs a test
- `cd Source/backend && npm run validate:security` — adapter SQL changes
- `cd Source/backend && npm run test:integration` — needs local Postgres only

Webapp (01, 02, 03, 05, 06):
- `cd Source/webapp && npm run lint` (`next lint && tsc --noEmit`)
- `cd Source/webapp && npm run test:unit`

**No DB migration in this series** — every change is read-only SQL plus presentation. `cdk synth`
is not required (no infrastructure change).

## Gotchas

- `rg`/`grep` are wrapped by a hook and can return garbled output via Bash — use `command grep`.
- `price_observation` has **no** tenant/line linkage (de-identified, §6.5) — rows can't be
  retro-corrected or joined back to an invoice.
- Own history is **one blended line per product**; market is **one line per (product, merchant)**.
- `--amber` is **never defined** as a CSS token. `workspace.css` uses `var(--amber, #d97706)` which
  always falls back to the literal and therefore does not theme. Use `var(--warning)` in new rules.
- Charts use a fixed `viewBox` plus `.chart-svg { width: 100% }` and `.chart-wrap { max-width: 960px }`
  — there is no `ResizeObserver` anywhere in the webapp. Label decluttering must be by count.
- `x()`/`y()`/`gridVals` are duplicated in exactly **two** webapp files (`line-chart.tsx`,
  `spend-over-time-chart.tsx`). Per `.claude/rules/code-quality-guard.md` Rule of Three, do **not**
  extract shared chart geometry yet — extract on the third chart.
- jsdom has no `PointerEvent` and returns zeroed `getBoundingClientRect`. `line-chart.tsx` uses
  `onMouseMove` so it needs no polyfill, but hover tests must stub `getBoundingClientRect` — copy the
  pattern from `spend-over-time-chart.test.tsx`.
- Backend integration tests connect as the table **owner** (RLS bypassed). Tenant-scoped assertions
  must `CREATE ROLE … NOLOGIN`, `SET LOCAL ROLE`, `set_config('app.current_tenant_id', …, true)` and
  always `ROLLBACK` — see `OwnPurchaseHistory.local.test.ts`.
- Env cheat-sheet: dev DB `wobblio_dev` (secret `shared/db/wobblio_dev`, user `wobblio_dev_app`);
  `DATABASE_URL` needs `?uselibpqcompat=true&sslmode=require`. **`wobblio` (no `_dev`) = PROD, never
  touch.** Deploy dev: `cd Source/infra && STAGE=dev npm run cdk:deploy:backend|cdk:deploy:web`.
- Local Postgres for integration tests: `cd scripts/local && docker compose up -d` (pgvector/pg15 on
  5432), then `cd Source/infra && npm run migrate:up`. LocalStack is **not** needed — the trend
  adapters fall back to `DEFAULT_AMBIGUITY_GAP` when no `IAmbiguityConfig` is injected.
