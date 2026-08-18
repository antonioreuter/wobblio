# 18e — Reports

> **HISTORICAL — superseded, do not read as current state.** Epic 19 replaced this screen with the
> personal-inflation CPI view and **deleted** the mobile price-trends client outright:
> `price_trend_comparison.dart`, `IPriceTrendRepository`/`HttpPriceTrendRepository`,
> `line_chart.dart` (`TrendLineChart`) and the `report_bloc` trio are gone. See
> `specs/mvp/19-mobile-2a-full/19-00-handoff.md`. The ticked checkboxes below describe code that no
> longer exists. Mobile does **not** consume `GET /price-trends/comparison`; the webapp keeps its
> trend chart (`specs/price-trends-rebuild/`). Kept for the contract record only.

**Mobile epic | Parent: [18](../18-mobile-navigation-and-lists.md) · Tracker: [18-00](./18-00-handoff.md)**

New port/adapter/bloc/screen triad + the `AppShell` nav change that finally fills the 5th bottom-nav
slot `18a` reserved. Depends on `18a` (bottom-tab shell).

## Current state

`AppShell` ships 4 nav slots (Home/Receipts/Scan/Shopping) — `18a`'s doc comment explicitly notes
Reports was omitted because it had no screen yet. `UserProfile`/`HttpProfileRepository` only model
`onboarded`/`fullName`/`role`/`status`; a comment on `UserProfile` already flags `country`/`currency`/…
as reserved for a later slice. This is that slice.

## Resolved conflict: `OPTION 2A`'s 4-level drill-down vs. no backend support

`OPTION 2A`'s "Reports" screen shows a category → merchant → product-category → products spend
drill-down. The backend has **no endpoint for that** — the only relevant route is
`GET /price-trends/comparison`, which serves the webapp's actual Reports page (product picker +
line chart of the caller's own purchase price history vs. the de-identified regional market trend).
**This slice builds the price-trend comparison screen instead, scoped to match the real backend
contract** — the same call epic 17 made for prototype/spec conflicts elsewhere. The 4-level
drill-down stays out of scope until a matching backend aggregation endpoint exists (no `18-00`
follow-up filed for it — it would need new spend-aggregation queries, not just a UI change).

## Backend contract

`GET /price-trends/comparison?products=<id,id,id>&country=NL&region=NL-NB` →
`Source/backend/src/core/services/data-intelligence/PriceTrendService.ts`'s `PriceTrendComparison`:
`{ countryCode, regionCode, weeks: 26, lines: ServedPriceTrendLine[], ownHistory: OwnPurchaseLine[] }`.
`lines` (the public de-identified market trend) is Premium-only — the backend serves `[] `for
STANDARD/non-Premium callers rather than a 403, so there is no forbidden screen state to build.
`ownHistory` (the caller's own purchase-price history) is RLS-scoped and always served regardless of
role. `products` is capped at 3 (`TREND_MAX_PRODUCTS`); country/region default from the caller's
profile.

## Scope

- **`UserProfile`** (`lib/core/auth/user_profile.dart`) extended additively with `country`/
  `regionCode` (`String`, default `''`) — parsed in `HttpProfileRepository.fetchProfile()` from
  `GET /me/profile`'s already-live `country`/`regionCode` fields (backend's `OnboardingProfile`).
- **Domain models** `lib/core/reports/price_trend_comparison.dart`: `WeeklyMedianPoint`,
  `MarketTrendLine` (backend's `ServedPriceTrendLine`), `OwnPurchaseLine`, `PriceTrendComparison` —
  field-for-field mirrors, `equatable`-based.
- **`IPriceTrendRepository`**/`HttpPriceTrendRepository` — one method,
  `comparison(productIds, countryCode, regionCode)`, over `GET /price-trends/comparison`.
- **`lib/ui/design_system/line_chart.dart`**: `TrendLineChart` wrapping `fl_chart`'s
  `LineChart(LineChartData(...))`. Accepts a presentation-only view model
  (`TrendChartSeries { label, color, dashed, points }`, `TrendChartPoint { weekIndex, price,
  discountPrice }`) built by the screen — no `core/reports/` wire types imported here, keeping the
  hexagonal boundary intact. Gaps (`price == null`) render via `FlSpot.nullSpot`, never coerced to
  zero; discount weeks render as a second, zero-width "line" whose only visible output is its dots
  (`barWidth: 0` + `dotData`), rather than joining the price line.
- **`ReportBloc`** (`lib/core/bloc/reports/{report_bloc,_event,_state}.dart`): `ReportStatus
  { loading, ready, failure }`. Product search reuses `IProductSearchRepository` and mirrors
  `ReviewBloc`'s debounce shape (min 2 chars, a generation counter dropping stale responses) — no new
  search port. `selectedProducts` capped at 3; add/remove is the only trigger for a
  `/price-trends/comparison` refetch (typing in the search box never refetches the chart — the two
  are fully decoupled, since suggestion search and comparison fetch are different repositories).
  `mode: {own, market}` defaults to `own`; switching to `market` is guarded server-side-mirrored
  client-side (`!isPremium` → no-op) even though the backend already returns `lines: []` for
  non-Premium, so there's no client-side 403 to handle. Unlike `ShoppingListBloc`/`BudgetBloc`'s
  fail-closed-to-a-safe-default pattern, a failed profile fetch on `ReportsStarted` has **no** safe
  fallback (there's no sane default country/region to query with), so it surfaces a genuine
  `ReportStatus.failure` with a retry instead of degrading.
- **`ReportsScreen`** (`lib/ui/reports/reports_screen.dart`): product search input + suggestion
  dropdown, selected-product `WobblioTag` chips (removable), read-only country/region text sourced
  from the profile (no region override picker in v1 — documented follow-up below), "My prices /
  Local market" segmented toggle (market side opens an upsell dialog instead of switching, for
  non-Premium), `TrendLineChart` fed from `comparison.ownHistory` (dashed) or `comparison.lines`
  (solid), a small legend row per series. Empty state before any product is selected. The
  chart-series/week-label view-model assembly (mapping `PriceTrendComparison` → `TrendChartSeries`)
  lives in the screen file, not the bloc or the design-system widget — the bloc stays wire-shape-free
  of `lib/ui/` types, and the widget stays reports-domain-free.
- **DI** (`main.dart`): `registerLazySingleton<IPriceTrendRepository>`, `registerFactory<ReportBloc>`
  (depends on `IPriceTrendRepository`, `IProductSearchRepository`, `IProfileRepository`) — a fresh
  bloc per Reports tab mount, same as `ShoppingListBloc`/`HistoryBloc`.
- **Nav — the `AppShell` change**: `ReportsScreen` added as `AppShell`'s 4th `IndexedStack` tab; a
  5th `BottomNavigationBarItem` (`Icons.insights_outlined`/`Icons.insights`) added at nav position 4.
  The `_index >= 2 ? _index + 1 : _index` / `tapped > 2 ? tapped - 1 : tapped` index-shift formulas
  from `18a` are **unchanged** — they only depend on there being exactly one non-stack slot (the Scan
  FAB, fixed at nav position 2), not on how many tabs follow it, so adding a 4th stack tab / 5th nav
  slot needed no formula change. Traced by hand for all 5 tap values (0, 1, 2, 3, 4) — see `18-00`.

## Out of scope / follow-ups

- The `OPTION 2A` category/merchant/product-category drill-down (no backend aggregation endpoint —
  see "Resolved conflict" above).
- A region-override picker (webapp has one via `RegionPicker`; v1 mobile is read-only, defaulted from
  the profile). Flag as a follow-up once there's a mobile pattern for a country/region selector.
- Date-range presets (webapp's `PRESETS`/custom from/to) — mobile always charts the full
  `TREND_WINDOW_WEEKS` (26 weeks) the backend serves.

## Checklist

- [x] `UserProfile`/`HttpProfileRepository` extended with `country`/`regionCode`
- [x] `IPriceTrendRepository`/`HttpPriceTrendRepository` over `GET /price-trends/comparison`
- [x] `TrendLineChart` design-system widget (gaps via `FlSpot.nullSpot`, discount dot markers, dashed
      own-purchase lines vs. solid market lines)
- [x] `ReportBloc` + `ReportsScreen` (product picker capped at 3, mode toggle Premium-gated,
      profile-fetch failure surfaces `failure` with retry)
- [x] `AppShell` gains the Reports tab + 5th nav slot; index-shift math re-verified unchanged
- [x] `main.dart` DI wiring
- [x] `test/bloc/report_bloc_test.dart` (loading/ready/failure, search debounce, add/remove/cap,
      comparison refetch + stale-response guard, mode-toggle premium gate)
- [x] `fvm flutter analyze` → 0 issues; `fvm flutter test test/bloc/` → green; `fvm flutter test test/`
      → green (full suite, including `smoke_test.dart` — its previously-documented
      `lucide_icons`/SDK compile failure no longer reproduces, see `18-00`)
