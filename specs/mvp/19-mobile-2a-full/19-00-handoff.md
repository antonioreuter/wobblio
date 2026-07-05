# 19-00 — Mobile "Prototype 2a" full-app conformance (living tracker)

**Mobile epic.** Bring the Flutter app (`Source/mobile/`) fully in line with **prototype 2a
("Spotlight Lean")** from `Mobile UI design principles/Wobblio Mobile.dc.html` — dark-theme,
numbers-first, glass chrome across all 12 screens. Extends epic 17 (design-system foundation, done)
and epic 18 (nav shell + net-new screens). Approved plan:
`~/.claude/plans/use-the-claude-design-mcp-iterative-sloth.md`.

> **Workflow:** implement one slice at a time, update this tracker + run gates, clear context between
> slices. Reuse the 17a design system verbatim — do **not** re-port tokens.

## Why this epic exists

Despite the "epic 17 + 18" commit, the actual screen **re-skins were never done**: the Dashboard is
still old Material chrome, net-new screens use Material `AppBar`, and the bottom nav was stock
`BottomNavigationBar`. This epic finishes the conformance and adds the one genuinely-new analytic
prototype 2a's Home needs (the inflation pulse — a personal price index that exists nowhere in the
product yet).

## Data reality for 2a's Home (decided: wire real integration)

- **Client-derivable (no new backend):** hero *Total grocery spend* + Month/Week + projection, and
  *Vs last month* — port `Source/webapp/src/lib/invoice-metrics.ts` (`computeSpendMetrics`) to Dart.
  *Credits* = `UsageSummary`; *Category budgets* = `BudgetBloc` (18d); *Recent* = `DashboardBloc`.
- **New backend analytic:** *Your inflation % / Eindhoven region % / sparkline* + *€ saved by
  switching shops* — new backend service + `GET /me/insights/inflation`, respecting invariant #2
  (Price Observation Store de-identified/RLS-exempt) and #8 (k≥3). This is the heavy/risky slice.

## Slices

| Slice | Title | Status |
|---|---|---|
| 19a | 2a nav shell + shared header (`WobblioNavBar`, `Wobblio2aHeader`) | ✅ |
| 19b | Home/Dashboard to full 2a (client-derived sections) | ✅ |
| 19c | Inflation-pulse backend + Home card | ✅ personal number (region/savings deferred) |
| 19d | Existing-screen re-skins: Onboarding, Capture, Review/Parse | 🚧 Capture deep body ✅; Onboarding + Review deep bodies pending |
| 19e | Net-new-screen re-chrome: Invoice Detail, History, Budgets, Reports, Account, Shopping, Notifications, Split, Processing | ✅ chrome |
| 19f | Deep-body prototype conformance, one screen at a time (started) | 🚧 Dashboard-Recent ✅, Invoice Detail ✅ |

Legend: ⬜ not started · 🚧 in progress · ✅ done

> **Per-screen review checklist:** [`19-01-screen-review.md`](19-01-screen-review.md) — status +
> concrete prototype divergences for all 13 screens, and the review workflow.

### 19f — deep-body conformance (incremental, 2026-07-03)
User re-flagged that most screens are chrome-only vs prototype 2a; agreed to conform bodies one screen
at a time (verified live on `emulator-5554`). Prototype = `Mobile UI design principles/Wobblio Mobile.dc.html`
(screens tagged `data-screen="N"`).
- **Dashboard Recent** ✅ — capped to 3, dropped tag chips, single-line ledger rows (see the 19b follow-up
  note below).
- **Invoice Detail** ✅ (`data-screen="3"`) — merchant glass card (name 16/700, mono-tabular €26 total),
  hairline info rows with `formatMediumDate` ("30 Jun 2026") + Location (single `locationLabel` — model has
  no country/region split, so not fabricated), "View original receipt" outline, **line items now show the
  `×qty` column** + right-aligned min-width-52 tabular amounts, feedback moved into a **glass card** with a
  question + hint (hint hides + question → "Thanks — that trains the scanner." once rated), Split/Share/Delete
  actions unchanged. New `formatMediumDate`/`formatQuantity` in `ui/format.dart`. All keys preserved
  (`invoice-detail-screen`, `-line-{id}`, `-feedback-up/down`, `-split-bill`, `-share`, `-delete`, `-photo`).
  Gates: analyze 0, 162 tests.
- **App-wide aurora fix (2026-07-03):** the `AuroraBackground` was mounted in `MaterialApp.home`, so it sat
  BELOW pushed routes — every pushed screen (Invoice Detail, Account, Budgets, Split, …) painted flat black
  and looked "completely different" from the prototype's atmospheric dark. Moved it to `MaterialApp.builder`
  (behind the whole Navigator) in `lib/app.dart`, so the aurora + glass now show on every route. This is the
  single biggest conformance win and fixes all pushed screens at once. analyze 0, 162 tests.
- **Invoice-Detail polish (2026-07-03):** "View original receipt" wrapped in `SizedBox(width: infinity)` so
  it's full-width with centered content (WobblioButton's `Center(widthFactor:1)` centers under tight
  constraints); Date value now uses the mono-tabular `display` face (`AppTypography.display(..., tabularNumbers)`)
  vs body; Share icon `Icons.ios_share` → `Icons.share` (share-nodes, matches proto). Date still has no time
  ("· 14:32") — model `transactionDate` is date-only; would need a backend timestamp.
- **Remaining Invoice-Detail deltas vs prototype (data-limited / deliberate, lower priority):** no merchant
  sub-line/branch ("Eindhoven Centrum" — model has no branch field); badge "READY" vs proto "PROCESSED"
  (deliberate canonical webapp label); info rows Date+Location vs proto Date(+time)/Country/Region (model has
  one combined `locationLabel`, date w/o time); merchant icon glyph differs.
- **History** ✅ (`data-screen="4"`, 2026-07-03) — rebuilt to the 2a lean ledger + reviewed on
  `emulator-5554`. `_LedgerRow` went from a two-line Column with **ISO dates** (`2026-07-02`) to a
  **single-line** `● merchant  "30 Jun"[· label]  €amt` row: `formatShortDate` for the date, the date +
  amount on the mono-tabular `display` face, merchant-color dot (warning tone + `· label` suffix only for
  warning-status rows). Header subtitle (`N scanned · €X this month`) switched to the mono-tabular face and
  the month-group label to overline **w700** to match the prototype. Search field + month grouping were
  already present (18b). All keys preserved (`history-screen`, `history-search`, `history-row-{id}`).
  Gates: analyze 0, 162 tests.
- **Capture** ✅ (`data-screen="2"`, 2026-07-03) — full rewrite of `capture/capture_screen.dart` from three
  stacked FilledButtons to the 2a scan viewfinder + reviewed on `emulator-5554`. Full-bleed dark scene
  (`#06070C` + radial wash), `Positioned` top bar (back chevron + centered "Scan receipt"), a 230×340 beige
  **receipt-preview mock** (platform `monospace`, no new font dep) framed by 4 brand `_Corner` brackets and an
  `AnimationController`-driven indigo→teal **laser sweep**, "Align the receipt · tap to scan" caption, a 74×74
  **shutter** (white 5px ring + `AppColors.gradientBrand` core) wired to `CaptureFromCameraRequested`, and
  **Gallery + PDF** as `OutlinedButton` secondaries. **Decision (asked user, both recommended options):**
  stylized viewfinder — NO live in-app camera feed (capture still routes through `image_picker`/OS camera; the
  prototype viewfinder is itself a static mock); Gallery/PDF kept as secondary buttons below the shutter.
  `CaptureBloc`/ports unchanged; keys preserved (`capture-screen`, `capture-camera-button`,
  `capture-gallery-button`, `capture-pdf-button`, `capture-progress`, `capture-error-snackbar`) + new
  `capture-back-button`. **LANDMINE (fixed during review):** the body `Stack` needed `fit: StackFit.expand`
  (else it collapsed to the top bar's height and everything bunched at the top / the receipt overflowed); and
  with `StackFit.expand` the top bar must be `Positioned` (a bare non-positioned child gets tight full-height
  constraints and vertically-centers). Gates: analyze 0, 162 tests.
- **Reports / "Price report"** ✅ code (`data-screen="6"`, 2026-07-04) — rebuilt `reports/reports_screen.dart`
  from the 18e product-picker + "My prices vs Local market" trend chart to the 2a **personal-inflation
  CPI** view. Sections: header "Price report" + "`<region>` · last 90 days" (region from profile,
  best-effort); "Your inflation vs region" **fixed-series proportional bars** (You=`success`/teal,
  Region=`warning`/amber, matching the sparkline's series identity — bar fill ∝ |pct| scaled to the larger
  of the two, honest `—`+hint on nulls); the reused dual-line **`InflationSparkline`** (extracted from the
  dashboard `_InflationPulse` into `design_system/inflation_sparkline.dart` — one copy, two call sites);
  and a "€X saved this year by switching" **glass card** (shown only for a real positive figure). All
  figures come from the existing `GET /me/insights/inflation` via a new **lean `PriceReportBloc`**
  (`core/bloc/reports/price_report_bloc.dart`, insight required → failure+retry, profile best-effort for
  the label). **Decisions (user):** *replace the 18e chart entirely* — deleted `price_trend_comparison.dart`,
  `IPriceTrendRepository`/`HttpPriceTrendRepository`, `line_chart.dart` (`TrendLineChart`), the old
  `report_bloc` trio + test, and their `main.dart` DI (kept `IProductSearchRepository` — Review still uses
  it; webapp keeps its trend chart). *Defer* the prototype's per-product **"Tracked items"** list (needs an
  endpoint field surfacing the matched-basket breakdown — the data already exists in
  `PersonalInflationQueryAdapter`) and the derived "X% cheaper than region" line. New
  `test/bloc/price_report_bloc_test.dart` (5 cases). Gates: analyze 0, tests green. **Backend now covered:**
  `src/tests/integration/InflationInsights.local.test.ts` (8 tests, green on the local Postgres stack)
  exercises all five inflation adapters against real SQL — personal matched basket + monthly series under a
  restricted RLS role (tenant isolation proven: tenantB never sees tenantA's rows), the regional matched
  basket + series over `price_observation` (k≥3 quorum, quarantine/discount/region filters), switching
  savings (sub-quorum products dropped), and the full personal-vs-region trend composed through the domain
  the way `handleInflationInsight` does (+10% personal / +20% region on the seeded basket). The prior
  "adapter SQL not integration-tested" landmine is retired; **on-device review of the mobile screen is still
  pending.**
- **Next candidate:** Review/Parse (`data-screen` confirm/review) — 2a inline-edit rows + "confirm each line"
  gate (19d deep body).

## Gates for every slice
- `cd Source/mobile && fvm flutter analyze` (0 issues) + `fvm flutter test` (green).
- Backend slices (19c): `npm run test:unit`, `npm run validate:security`,
  `npm run skill:hexagonal-architecture-validator` (exit 0), `cdk synth` clean.
- Preserve every existing widget `Key` — tests depend on them.

## Slice notes

### 19a — ✅ (2026-07-03)
- Added `AppColors.navBg` (`--nav-bg` rgba(9,12,21,0.85)) — the one token gap vs the canonical
  `_ds/tokens/*.css` (rest of `tokens.dart` reconciled clean against the design MCP source).
- New `lib/ui/design_system/wobblio_nav_bar.dart` — floating glass pill (`.bnav`) with brand active
  dot + raised gradient capture FAB (`.fab`, Lucide `camera`) spliced at `captureIndex`. Nav glyphs:
  `layout_dashboard`/`receipt`/`shopping_cart`/`chart_pie`.
- New `lib/ui/design_system/wobblio_header.dart` — `Wobblio2aHeader` (greeting + Outfit title +
  trailing actions) and `HeaderIconButton` (40×40 hairline square, optional unread dot).
- `app_shell.dart`: dropped the Material `BottomNavigationBar` + index-shift math; now
  `Scaffold(backgroundColor: transparent, extendBody: true)` with the nav overlaid via `Stack` +
  `Positioned`, and a `MediaQuery` bottom-padding injection (+96) so tab scroll content clears the
  floating pill. `Key('app-shell')`/`Key('app-shell-nav')` preserved.
- Gates: analyze 0 issues, 153 tests green.
- **Landmine for later slices:** the aurora only shows once each tab's own `Scaffold` sets
  `backgroundColor: Colors.transparent` — that's part of each screen's re-skin (19b/19d/19e).

### 19b — ✅ (2026-07-03)
- Rebuilt `lib/ui/dashboard/dashboard_screen.dart` to the 2a Home. Sections: `Wobblio2aHeader`
  (time-of-day greeting from `AuthBloc`'s `UserProfile.fullName`, "Your money", bell→Notifications,
  avatar→Account); typographic hero (grocery spend + Month/Week toggle + signed delta + vs-last-period
  caption); hairline Vs-last-period / Credits split row; category-budgets preview (top 3 from
  `BudgetBloc`); recent-invoices **ledger rows** (status-tone/merchant-color dot, hairline dividers).
- New core `lib/core/reports/spend_metrics.dart` (`computeSpendMetrics`) ported from the webapp's
  `invoice-metrics.ts`, extended with a WEEK bucket for the toggle; calendar-date arithmetic to dodge
  tz drift. Unit-tested in `test/spend_metrics_test.dart` (7 cases).
- Screen is now a `MultiBlocProvider` (`DashboardBloc` + `BudgetBloc`); `Scaffold` is transparent so
  the aurora shows. Dashboard's own capture FAB removed — capture lives in the nav (19a). All existing
  `Key`s preserved (`dashboard-screen`, `invoice-card-{id}`, `status-pill`, `feedback-up/down`,
  `tag-filter-row`, `usage-pill`, `dashboard-notifications-button`, `dashboard-account-button`).
- **Resolved deviations:** (1) category-budget bars use the DS `ProgressBar`'s semantic health tones
  (teal/amber/rose), not the prototype's decorative brand fill — matches the webapp's budget bars and
  is more honest. (2) hero has no cap/stacked-bar (mobile has no total-spend budget wired); shows the
  vs-last-period delta caption instead of a fabricated projection cap. (3) budgets section hides
  entirely for non-premium/empty (no fabrication).
- Gates: analyze 0 issues, 160 tests green (153 + 7 new).

#### 19b follow-up — Recent-list prototype conformance (2026-07-03)
The 19b ledger still diverged from prototype 2a's Home "Recent" block (it rendered the *full* filtered
ledger with a tag-filter chip row and a per-row tags+thumbs second block). Brought it to the prototype:
- **Cap to the 3 most recent** invoices (`state.invoices.take(3)`); full list stays one tap away via
  "See all" → History.
- **Removed the tag-filter chip row** (`_TagFilterRow`) — not in the prototype. `DashboardBloc`'s
  `DashboardTagSelected`/`visibleInvoices`/`availableTags` are **left intact** (still unit-tested); only
  the widget was dropped. Keys `tag-filter-row`, `feedback-up`, `feedback-down` are **gone** (no widget/
  acceptance test referenced them — dashboard tests are bloc-level only).
- **Single-line ledger rows** to match the prototype: `● merchant · "12 Jun · status" · €amount`. Dropped
  the per-row tags `Wrap` + `_FeedbackRow` thumbs. The accuracy-feedback thumbs still exist on the
  **Invoice Detail** screen, so the feature is not lost. New `formatShortDate()` in `ui/format.dart`
  renders the `"12 Jun"` date.
- **Kept** our canonical status labels ("Ready" for PARSED/NEEDS_REVIEW, etc. — the documented webapp
  `STATUS_MAP` decision) rather than the prototype's literal "Processed"/"Needs review" text.
- Gates: analyze 0 issues, 162 tests green. Keys preserved: `dashboard-screen`, `invoice-card-{id}`,
  `status-pill`, `usage-pill`, `dashboard-notifications-button`, `dashboard-account-button`.

### 19d/19e — chrome ✅ (2026-07-03)
- New `WobblioHeaderBar` (a `PreferredSizeWidget` wrapping `Wobblio2aHeader` in `SafeArea`) added to
  `wobblio_header.dart` + a `onBack` chevron on `Wobblio2aHeader` (`Key('header-back')`), so pushed
  screens get the 2a glass header in the `appBar:` slot without body surgery.
- **Every screen `Scaffold` is now `backgroundColor: Colors.transparent`** so the mounted aurora shows
  app-wide (the 19a landmine is cleared for: dashboard, history, shopping, reports, account, budgets,
  notifications, split, invoice-detail, capture, review, login, onboarding).
- Material `AppBar(title:)` → `WobblioHeaderBar(title:, onBack: maybePop)` on the pushed screens:
  account, budgets, notifications, split, invoice-detail, capture, review. Tabs (history/shopping/
  reports) kept their existing custom headers; only their background went transparent.
- Gates: analyze 0 issues, 160 tests green. All existing screen `Key`s preserved.
- **Remaining (deep body rebuilds, not just chrome):** the internal layouts of Capture (2a radial-
  shutter viewfinder), Review/Parse (2a inline-edit), and Onboarding (2a hero) still use their
  pre-2a DS-based bodies under the new header — faithful-2a internals are follow-up work. Also verify
  the shell's floating nav doesn't occlude the Shopping/Reports Scaffold FABs (the shell injects +96
  bottom padding, which Scaffold FABs should honor — confirm on device).

## Remaining after this session
- **19c — inflation-pulse backend + Home card (NOT STARTED):** the signature 2a Home card (personal
  inflation % vs Eindhoven region %, sparkline, "€ saved by switching shops"). This is a genuinely new
  analytic that exists nowhere in the product. Building block: `OwnPurchaseHistoryQueryAdapter`
  (RLS-scoped weekly medians over the caller's `invoice_line`) is the basis for a matched-basket
  personal price index. Scope decision from the plan: build the personal-inflation number for real;
  regional index + savings-counterfactual may defer to honest empty states (webapp rule #4). New
  backend port/adapter/service + `GET /me/insights/inflation`, then mobile port/adapter/BLoC field +
  the card. Gate with `test:unit`, `validate:security`, `skill:hexagonal-architecture-validator`.
- **19d deep bodies:** Capture/Review/Onboarding internal 2a layouts.

### Code-review fixes (2026-07-03, applied to 19b)
A high-effort `/code-review` pass on the 19a/19b/19d/19e diff surfaced 4 findings, all fixed:
1. **Home header under the status bar** — Home had no `AppBar`/`SafeArea`, so "Your money" overlapped
   the status bar. Wrapped `_Body`'s `CustomScrollView` in `SafeArea`.
2. **Single-currency assumption** — hero summed `inv.total` across all invoices under
   `invoices.first.currency`. Now filters to same-currency invoices (`spendInvoices`) so total + symbol
   agree (mobile has no home-currency field to convert into).
3. **DST week-bucketing edge** — `spend_metrics._periodKey` week branch now uses `DateTime.utc` (no DST)
   for the week ordinal instead of local time.
4. **Double bottom padding** — removed the manual `bottomInset + s6` trailing sliver; the new `SafeArea`
   consumes the shell's injected bottom padding for nav clearance (was double-counted).
Re-gated: analyze 0 issues, 160 tests green.

### 19c — ✅ personal inflation (2026-07-03)
Built the signature Home inflation-pulse card, backed by a real analytic (region index + savings
deferred to honest nulls, per the plan).
- **Backend:** `core/domain/personalInflation.ts` (`computePersonalInflation` — median-of-ratios over a
  matched basket, `MIN_INFLATION_BASKET=3`, returns null below that — never a fake 0%), port
  `IPersonalInflationQuery`, adapter `PersonalInflationQueryAdapter` (RLS-scoped matched-basket SQL
  over `invoice_line`, current 90d vs prior 90d, modeled on the proven `OwnPurchaseHistoryQueryAdapter`
  — regular non-deposit/non-discount lines, €/unit when size known else €/item), route
  `GET /me/insights/inflation` returning `{personalInflationPct, basketSize, regionInflationPct:null,
  savedBySwitching:null}`. Gates: 7 domain unit tests green, hexagonal validator exit 0, `tsc` clean,
  `validate:security` pass. **LANDMINE:** the adapter SQL is NOT integration-tested yet — verify against
  a seeded tenant before trusting the number in prod.
- **Mobile:** domain `inflation_insight.dart`, port `IInsightsRepository` + `HttpInsightsRepository`,
  `DashboardBloc` gained a best-effort `inflation` field (never fails the load, like usage), DI wired in
  `main.dart`, and the `_InflationPulse` `GlassContainer` card on Home (shown only when a real personal
  number exists; region line renders a "building" state). 2 new bloc tests. Gates: analyze 0, 162 tests.
- **Deferred (honest nulls today):** regional inflation index + "€ saved by switching shops" (optimizer
  counterfactual) + the dual sparkline (backend returns no series yet).
