# 18-00 — Mobile Navigation & Net-New Screens Handoff (living tracker)

**Mobile epic | Parent: [18 — Mobile Navigation & Net-New Screens](../18-mobile-navigation-and-lists.md)**

> **Workflow:** implement **one slice at a time**, update this tracker + the slice's checklist, then
> **clear context between slices**. Don't carry one slice's working set into the next.

## Slices

| Slice | Title | Status | Depends on |
|---|---|---|---|
| [18a](./18a-bottom-tab-shell.md) | Bottom-tab shell | ✅ | 17a |
| [18b](./18b-history-invoice-detail.md) | History + Invoice Detail | ✅ | 18a |
| [18c](./18c-shopping-list.md) | Shopping List | ✅ | 18a |
| [18d](./18d-budgets.md) | Budgets | ✅ | 18a |
| [18e](./18e-reports.md) | Reports | ✅ | 18a |
| [18f](./18f-account.md) | Account | ✅ | 18a |
| [18g](./18g-notifications.md) | Notifications | ✅ | 18a |
| [18h](./18h-split-bill.md) | Split Bill | ✅ | 18a, 18b |

Status legend: ⬜ not started · 🚧 in progress · ✅ done

**Dependency DAG:** `18a → {18b, 18c, 18d, 18e, 18f, 18g}`. `18b`/`18c` touch disjoint screens and can
build in either order once `18a` lands. `18h` (Split Bill) additionally depends on `18b` since it's
reached from Invoice Detail.

## Deferred / known gaps

- **18h built (✅) 2026-07-02 — last of the 18d–18h block, all five slices now ✅.** This closes the
  "No Split-bill button" gap `18b`'s entry below flagged. New `lib/core/splitting/` domain models
  (`SplitAssignment`, `SplitItem`, `SplitParticipant`, `SplitSummary`, field-for-field mirrors of the
  backend's `splitRoutes.ts` contract); `ISplitRepository`/`HttpSplitRepository` (the six
  `/invoices/{id}/splits...` routes, a thin 1:1 wire mapping with no caching logic of its own) +
  `ISplitIdCache`/`SharedPrefsSplitIdCache` (key `'wobblio:split:$invoiceId'`, `shared_preferences`-backed).
  **Split-id resolution is the interesting part:** `POST /invoices/{id}/splits` has no idempotency —
  no "list splits for invoice" endpoint exists, so a naive reopen would mint an orphaned split row
  every time. `SplitBillBloc._resolveSplitId` ports the webapp's `use-bill-split.ts` `resolveSplitId`
  exactly: a cached id is validated with a `GET`, and *any* failure of that validation call (not just a
  404) falls back to minting + caching a fresh split — the cache lives on the bloc, not the repository
  port, keeping the port a thin wire mapping. `SplitBillBloc` (`SplitBillStatus { loading, ready,
  forbidden, failure }`) is the most stateful of the five 18d–18h slices: fail-closed premium gate
  (mirrors `BudgetBloc`/`ShoppingListBloc` — non-premium never attempts a single split API call);
  `SplitBillLineTapped` ports `bill-split-dialog.tsx`'s `handleLineTap` state machine verbatim — `"You"`
  active only ever unassigns (never a PATCH, it's the implicit remainder owner), an unassigned or
  differently-owned line assigns at fraction 1, a line already owned by the active participant cycles
  `[1, 0.5, 1/3]` with `FRACTION_EPSILON = 1e-3` ported together with the webapp's own comment
  explaining why (`bill_split_line.fraction` is `NUMERIC(5,4)`, so `1/3` round-trips through the
  backend as `0.3333`, not Dart's repeating-binary literal); `participants` is a local-only growing set
  (seeded from assignments' distinct names, grown after every refresh, never shrunk except an explicit
  `SplitBillParticipantRemoved`, which unassigns every line the removed person held via `Future.wait`
  and reverts the local list + shows a notice only if one or more of those unassigns actually failed).
  Every mutation refetches `assignments`+`summary` from the backend rather than recomputing the
  fee-pool-proportional-share math client-side. **Landmine hit and fixed during this slice:** the first
  `_onStarted` implementation started three futures (invoice detail, split assignments, split summary)
  as unawaited local variables and awaited them out of order to get concurrency — a classic Dart
  footgun, since a rejected `Future` sitting in a local variable between its creation and a later,
  out-of-order `await` can get flagged as an unhandled zone error before the `await` ever reaches it
  (reproduced concretely by a test whose fake made `getSplit` always throw). Fixed by switching to
  `Future.wait([...])`, which subscribes to all three immediately and still runs them concurrently.
  `SplitBillScreen` — non-premium sees an in-place `GlassContainer` upsell (mirrors the webapp's
  `budget-upsell` card; the entry point on `InvoiceDetailScreen` stays visible for everyone, matching
  the webapp's own pattern of not hiding the launcher) — people chips (fixed `"You"` + growing
  participant chips, `Avatar` initials, a small local 9-color palette mirroring the webapp's
  `seriesColor`), assignable line rows with an owner-avatar + fraction badge, per-person summary cards,
  WhatsApp share/copy buttons dispatching to `ISharePresenter` via the bloc (never called directly from
  the widget). Small additive change: `WobblioInput` gained an optional `onSubmitted` param (Enter-to-submit
  on the "Add a person" field) — backward compatible, no other caller passes it. `InvoiceDetailScreen`
  gained a "Split bill" outline button next to Share, always enabled, pushing
  `SplitBillScreen(invoiceId: detail.id)`. `fvm flutter analyze` → 0 issues; `fvm flutter test test/` →
  153 green (26 new in `split_bill_bloc_test.dart`, covering the premium gate, all three split-id
  resolution paths, a full fraction-cycle walk plus a `NUMERIC(5,4)`-round-trip epsilon-boundary
  fixture, "You"-active-never-PATCHes, participant add/remove edge cases, post-mutation refetch, and
  WhatsApp share vs. copy routing). Full details: [18h-split-bill.md](./18h-split-bill.md).
- **18e built (✅) 2026-07-02.** This is the slice that finally fills the bottom-nav 5th slot gap
  `18a`/`18d`/`18f`/`18g`'s entries below reference — `AppShell` now has all 5 `OPTION 2A` nav
  slots wired (Home/Receipts/Scan/Shopping/Reports). New `lib/core/reports/price_trend_comparison.dart`
  (`WeeklyMedianPoint`, `MarketTrendLine` — named to avoid confusion with the backend's
  `PriceTrendLine`/`ServedPriceTrendLine`, `OwnPurchaseLine`, `PriceTrendComparison`, all
  `equatable`-based, field-for-field mirrors of `PriceTrendService.ts`'s shapes);
  `IPriceTrendRepository`/`HttpPriceTrendRepository` (`GET /price-trends/comparison`); new
  design-system widget `lib/ui/design_system/line_chart.dart`'s `TrendLineChart` wrapping
  `fl_chart`'s `LineChart` — takes a presentation-only `TrendChartSeries`/`TrendChartPoint` view
  model (no `core/reports/` types imported), gaps render via `FlSpot.nullSpot` (not coerced to
  zero), discount-week markers render as a zero-width second `LineChartBarData` whose only visible
  output is its dots. `ReportBloc` (`ReportStatus { loading, ready, failure }`) + `ReportsScreen`:
  product search reuses `IProductSearchRepository` and mirrors `ReviewBloc`'s debounce shape (min 2
  chars, generation-counter guard against stale responses) rather than inventing a new search
  pattern; `selectedProducts` capped at 3, add/remove is the only trigger for a comparison refetch
  (typing never refetches — search and comparison are different repositories, so this decoupling is
  automatic, not a bolted-on guard); `mode: {own, market}` defaults to `own`, switching to `market`
  is a no-op for non-Premium (the screen shows an upsell dialog instead) even though the backend
  already returns `lines: []` for non-Premium rather than a 403. **Design call:** unlike
  `ShoppingListBloc`/`BudgetBloc`'s fail-closed-to-a-safe-default pattern, a failed profile fetch on
  `ReportsStarted` surfaces a genuine `ReportStatus.failure` (with retry) instead of degrading —
  there's no sane default country/region to query `/price-trends/comparison` with, unlike a flat
  shopping checklist or a budgets upsell card. `UserProfile`/`HttpProfileRepository` extended
  additively with `country`/`regionCode` (both default `''`), finally filling the "reserved for
  later slices" fields flagged since `18f`. **Conflict resolved:** `OPTION 2A`'s Reports screen is a
  4-level category→merchant→product-category→products spend drill-down with no matching backend
  endpoint (`GET /price-trends/comparison` is the only relevant route, and it's what the webapp's
  actual Reports page already uses) — this slice builds the price-trend comparison screen instead;
  see [18e-reports.md](./18e-reports.md) for the full write-up. **AppShell index-shift math verified
  unchanged:** the `_index >= 2 ? _index + 1 : _index` / `tapped > 2 ? tapped - 1 : tapped` formulas
  from `18a` only depend on there being exactly one non-stack slot (Scan, fixed at nav position 2),
  not on how many tabs follow it — traced by hand for all 5 tap values (0→Home, 1→Receipts,
  2→Capture, 3→Shopping, 4→Reports) and confirmed correct with no code change to the formulas
  themselves. **Also discovered while running the full suite for this slice:** `test/smoke_test.dart`
  — documented below as pre-existing-broken (a `lucide_icons`/pinned-SDK `IconData` incompatibility)
  — now compiles and passes cleanly; a prior slice's `flutter_lucide` swap (see the mobile-18
  navigation memory) fixed it as a side effect without this doc being updated. `fvm flutter analyze`
  → 0 issues; `fvm flutter test test/bloc/` → 121 green (15 new in `report_bloc_test.dart`);
  `fvm flutter test test/` → 128 green, full suite, no known failures left. **Side effect:** running
  `dart fix --apply` + `dart format` repo-wide to clear `require_trailing_commas` lint noise this
  slice's new files exposed also reformatted a number of already-shipped files (design-system
  widgets, several screens) — cosmetic only (trailing commas / line-wrapping, verified no semantic
  diff), but worth knowing if a reviewer sees a wider diff than this slice's own file list. Full
  details: [18e-reports.md](./18e-reports.md).
- **18g built (✅) 2026-07-02.** New `lib/core/notifications/app_notification.dart` (`AppNotification`,
  mirrors `NotificationView` field-for-field, `isUnread` getter for `readAt == null`);
  `INotificationRepository`/`HttpNotificationRepository` (`/notifications...`); `NotificationBloc`
  (`NotificationStatus { loading, ready, empty, failure }`) + `NotificationsScreen`, reached via a
  net-new bell `IconButton` (`Icons.notifications_none`) on `DashboardScreen`'s `AppBar`, between the
  existing `_UsagePill` and `_AccountButton` (18f) — no unread-count badge in this slice, deferred per
  the approved plan. New `formatRelativeTime` helper added alongside `formatMoney` in
  `lib/ui/format.dart` (`"Xm"`/`"Xh"` under a day, `"1d"` at exactly one day, a weekday abbreviation
  from two days to a week, then a short `"MMM d"` date) — hand-rolled 7/12-element lookup tables
  rather than pulling in `intl`, which nothing else in this app uses. **Mark-read/mark-all-read follow
  the same concurrency-safe optimistic-revert shape `18-00-handoff.md`'s post-review fixes established
  for Shopping List:** a single mark-read reverts only its own item, looked up fresh against
  `state.items` at failure time (not a snapshot from handler entry); mark-all-read flips every
  currently-unread id optimistically in one emit, fires `markRead` for all of them via `Future.wait`
  with per-call error collection (not fail-fast), and on partial failure reverts only the ids that
  actually failed — the ids that succeeded stay marked read, and a single toast notice covers the
  whole batch. `kind` is a free-form backend string (`AlertKind` currently only emits `BUDGET_85`/
  `BUDGET_100`) — the icon/tone mapping is a `switch` with a required default case (brand `info_outline`)
  rather than an exhaustive enum-shaped mapping, so an unrecognized future kind still renders sensibly.
  Icons are plain Material `Icons.*`, matching every other 18a–18f screen (`flutter_lucide` stays
  scoped to `MerchantIcon` only). `fvm flutter analyze` → 0 issues; `fvm flutter test test/bloc/` →
  106 green (7 new in `notification_bloc_test.dart`). Full details:
  [18g-notifications.md](./18g-notifications.md).
- **18f built (✅) 2026-07-02.** New pure function `lib/core/auth/jwt_claims.dart`'s
  `decodeIdTokenClaims(String idToken)` base64url-decodes a JWT's payload segment and JSON-decodes it
  — display-only, no signature verification (the token already passed Cognito auth to get this far),
  manually pads the segment to a multiple of 4 since JWT base64url omits `=` padding, and never throws
  (malformed input of any kind — wrong segment count, bad base64, non-JSON payload, non-object JSON —
  yields `{}`). Used because `GET /me/profile` has no `email` field; the Cognito ID token already held
  by `ISecureTokenStore` does, as a standard claim, so decoding it client-side avoids an unnecessary
  backend round-trip/endpoint. New `AccountBloc` (`AccountStatus { loading, ready, failure }`) fetches
  `IProfileRepository.fetchProfile()` and `ISecureTokenStore.read()` concurrently via `Future.wait`;
  a null/unrecoverable email (no session, or a token whose payload has no `email` claim) still reaches
  `ready` rather than `failure` — only a thrown profile-fetch or token-store-read failure does that.
  Sign-out is deliberately not an event on this screen-scoped bloc — `AccountScreen` dispatches
  `AuthLogoutRequested` straight at the app-wide `AuthBloc` (provided at the root in `app.dart`, so
  `context.read<AuthBloc>()` resolves from any screen), since that bloc already owns the session
  lifecycle `AuthGate` reacts to. **Budgets entry-point decision:** `18d` shipped `BudgetsScreen` with
  no nav wiring; this slice adds the entry point as a tappable row on `AccountScreen` (`Navigator.push`
  to `const BudgetsScreen()`, no constructor args) rather than a 6th bottom-nav tab, matching the
  already-user-confirmed scope decision recorded at the top of this doc. **Nav:** `DashboardScreen`'s
  `AppBar.actions` gains a net-new `_AccountButton` (profile icon) next to the existing `_UsagePill` —
  not a relocation, there was no prior icon to move. **Scope call:** `AccountScreen` only renders the
  fields `UserProfile` actually models (`fullName`, `role`, `status`) — no country/currency/region row,
  since those aren't parsed onto `UserProfile` yet (reserved for `18e`'s extension) and inventing them
  here would silently break the moment `18e` actually adds them under a different shape. `fvm flutter
  analyze` → 0 issues; `fvm flutter test test/bloc/` → 98 green (6 new in `account_bloc_test.dart`);
  `fvm flutter test test/jwt_claims_test.dart` → 6 green (new file — pure-function unit tests colocated
  at `test/` top level since no `test/unit/` convention exists in this repo). Full details:
  [18f-account.md](./18f-account.md).
- **18d built (✅) 2026-07-02.** New `lib/core/budgets/budget.dart` (`Budget`, mirrors `BudgetView`
  field-for-field, `isEditable` getter for `scope == 'TOTAL' || scope == 'CATEGORY'`) and
  `lib/core/reference/category.dart` (`Category { id, name }`); `IBudgetRepository`/
  `HttpBudgetRepository` (`/budgets...`) and `IReferenceRepository`/`HttpReferenceRepository`
  (`GET /reference/categories`); `BudgetBloc` (`BudgetStatus { loading, ready, empty, forbidden,
  failure }`) + `BudgetsScreen` (not wired into any nav yet — `18f` adds the Account-screen entry
  point). **Conflict resolved:** `GET /budgets` has no premium gate (only `POST` does), so the
  `forbidden` upsell state is decided client-side from `IProfileRepository.fetchProfile().role`
  before ever calling `list()` — mirrors `ShoppingListBloc._safeIsPremium`'s fail-closed pattern
  (a profile-fetch failure also renders the upsell, the safe default). A 403 hit later on a mutation
  (most commonly `NotHouseholdOwnerError`, which fires for `TOTAL`/`CATEGORY` too when the caller is
  a non-owner household member, not just `MEMBER`/`HOUSEHOLD`) surfaces as a toast notice instead of
  collapsing the whole screen, since the already-loaded list is still valid. **MEMBER/HOUSEHOLD
  decision:** v1's create/edit dialog only offers `TOTAL`/`CATEGORY` scope — no mobile household
  roster port exists to build a member picker. Pre-existing `MEMBER`/`HOUSEHOLD` budgets (e.g.
  created via the webapp) still list on mobile but render read-only (`Budget.isEditable == false`)
  with a generic label ("Household member budget" / "Household budget"), no edit/delete affordance.
  `fvm flutter analyze` → 0 issues; `fvm flutter test test/bloc/` → 92 green (17 new in
  `budget_bloc_test.dart`). Full details: [18d-budgets.md](./18d-budgets.md).
- **18a/18b/18c built (✅) 2026-07-02.** `fvm flutter analyze` → 0 issues; `fvm flutter test test/bloc/`
  → 70 green (22 new: `history_bloc_test.dart`, `invoice_detail_bloc_test.dart`,
  `shopping_list_bloc_test.dart`). New port methods: `IInvoiceRepository.getDetail/delete/createShare`
  (backed by `HttpInvoiceRepository`, reusing the existing `InvoiceDetail` model with two additive
  fields — `locationLabel`, `feedbackVerdict`); `IApiClient.patch` (new — the shopping-list item/region
  routes only match on `PATCH`, `PUT` 404s); `IShoppingListRepository` (new, `HttpShoppingListRepository`).
  New dependency: `share_plus: ^10.1.4` (native OS share sheet for Invoice Detail's Share button).
- **Post-review fixes (2026-07-02):** a `/code-review` pass (8 finder angles + verification) found 10
  confirmed bugs across 18a/18b/18c, all fixed: (1) `ShoppingListBloc` toggle/remove reverts now patch
  only the touched item against fresh `state.list` at failure time instead of a stale captured
  snapshot, since flutter_bloc processes events concurrently and a slow failure could otherwise clobber
  a different, already-succeeded edit; (2) `InvoiceDetailBloc._onFeedback` gained the same
  stale-failure-supersede guard `DashboardBloc._onFeedback` already had; (3) `ShoppingListStoreGroup
  .subtotal` is now summed from the rows that actually survive the productId merge, not copied from
  the optimizer's snapshot, so it stays correct after a removal; (4) `HistoryScreen` switched from
  `BlocBuilder` to `BlocConsumer` so refresh failures actually show a SnackBar; (5/6) `InvoiceDetailBloc`
  and `ShoppingListBloc` now clear `notice` at the start of every retryable action, so two consecutive
  identical-text failures don't get silently deduped away by `listenWhen`/`bloc`'s own emit equality
  check; (7) Invoice Detail's status badge now uses the canonical `statusViewFor` (`invoice_status.dart`)
  instead of a private mapping that had drifted to a different label ("Processed" vs. "Ready") for the
  same status; (8) `share_plus` moved behind a new `ISharePresenter` port/`SharePlusPresenter` adapter —
  `InvoiceDetailBloc` now calls it directly and `shareUrl` was removed from state entirely, rather than
  the widget importing `share_plus` and round-tripping a URL through state; (9) `HttpInvoiceRepository`
  and `HttpReviewRepository` now share one `parseInvoiceDetail`/`parseInvoiceLine` wire-parser
  (`invoice_detail_parser.dart`) instead of two independently-maintained copies that had already drifted
  (`locationLabel`/`feedbackVerdict` were only parsed in one of the two); (10) see the Capture-refresh
  entry above. `fvm flutter analyze` → 0 issues, `fvm flutter test test/bloc/` → 75 green (5 new
  regression tests: concurrent toggle/remove race, subtotal recompute after removal, delete-twice /
  add-twice notice-reset, share-link handoff, feedback supersede-guard). One pre-existing fixture bug
  surfaced by the subtotal fix: `shopping_list_bloc_test.dart`'s `_optimized()` fixture had
  `subtotal: 11.65` that never matched its own single `1.89` line — the old (buggy) code trusted the
  backend snapshot blindly so the mismatch went unnoticed; corrected the fixture to be internally
  consistent.
- **No longer reproduces (confirmed 2026-07-02 while building `18e`): `test/smoke_test.dart`**
  was documented here as failing to *compile* (`flutter test`, not `flutter analyze`) with
  `lucide_icons-0.257.0`'s `LucideIconData extends IconData` against the pinned SDK's `final class
  IconData`. Running the full `fvm flutter test test/` suite for `18e` shows it compiling and
  passing cleanly — a prior slice's `flutter_lucide` swap (memory: "lucide_icons landmine actually
  blocked whole app build — FIXED via flutter_lucide swap") resolved this as a side effect without
  this doc being updated at the time. Leaving the original note below for history; treat it as
  stale, not current.
  - ~~Pre-existing, unrelated: `test/smoke_test.dart` fails to *compile*~~ (`flutter test`, not
    `flutter analyze`) with `lucide_icons-0.257.0`'s `LucideIconData extends IconData` — the pinned
    SDK (`.fvmrc` → Flutter 3.44.4) declares `IconData` as a `final class`, which
    `lucide_icons ^0.257.0` predates. Verified via `git diff pubspec.lock` that this epic's
    `flutter pub get` didn't touch `lucide_icons`'s resolved version — the incompatibility is
    between the already-pinned SDK and the already-pinned package, exposed the first time
    `flutter test` tries to compile the full widget tree (only `smoke_test.dart` does this; every
    `bloc_test` file compiles pure Dart and is unaffected).

- **Fixed (`18e`, 2026-07-02): Reports tab was omitted from the bottom nav** in `18a`. `OPTION 2A`'s
  bottom nav has 5 slots (Dashboard/Receipts/FAB/Shopping/Reports); Reports had no screen yet, so —
  per epic 17d's own precedent of dropping the notification bell rather than linking to a dead
  screen — `18a` shipped 4 slots. `18e` adds the Reports screen and the 5th nav slot back.
- **Fixed (2026-07-02, post-review):** capturing via the bottom-nav Scan button now remounts Dashboard
  and History (a key-salt bump forces fresh `BlocProvider`s, i.e. a fresh fetch) and jumps to Home, so
  a newly captured receipt is visible immediately — `AppShell._openCapture` now awaits the pushed
  route's result instead of firing-and-forgetting it. `AppShell` still holds no reference to either
  screen's screen-scoped bloc (each tab owns its own, per 18a); remounting rather than lifting bloc
  ownership into the shell was the right-sized fix.
- **`GET /invoices` has no server-side pagination** — hardcoded `limit=100`, no query params. `18b`'s
  History screen reuses this as-is (client-side search/grouping over ≤100 results). Flag true
  pagination as a backend follow-up once usage data shows it's needed; not a blocker at current scale.
- **Fixed (`18h`, 2026-07-02): Invoice Detail had no Split bill button** (`18b`). No `hasSplit`/
  `canSplit` field exists on the `InvoiceDetail` backend contract, and `POST /invoices/{id}/splits`
  mints a new row on every call with no idempotency — `18h` replicated the webapp's
  `localStorage`-cached split-id workaround (`Source/webapp/src/components/workspace/use-bill-split.ts`)
  via a new `ISplitIdCache`/`SharedPrefsSplitIdCache`, and `InvoiceDetailScreen` now has a working
  "Split bill" button. See the `18h built` entry above.
- **Shopping lists are per-user, not household-scoped.** This corrects an assumption carried over
  from the initial design-folder read. Verified in the migration
  (`shopping_list.tenant_id → app_user(id)`), RLS policy, `IShoppingListRepository`, and the webapp's
  `lists` page — zero `household` references anywhere in that stack. `18c` does not build a household
  picker.
- **Split-route optimizer (`POST /lists/{id}/optimize`) and region override (`PATCH /lists/{id}/region`)
  are Premium-gated** (`403 PremiumRequiredError` for STANDARD). `18c` must degrade gracefully — flat
  checklist, no store-grouping banner — for STANDARD users rather than surfacing the 403.
- **Prototype vs. spec conflicts:** none identified beyond the two affordance-omission calls above.
  Each future slice file must call out any conflict it finds between `OPTION 2A` markup and an
  existing backend contract or hard invariant, with the resolution taken — same convention as epic 17.

## Conventions for every slice

- Flutter app lives in `Source/mobile/`. Follow `.claude/rules/flutter-architecture-guard.md`: ports
  in `lib/core/ports/`, adapters in `lib/infrastructure/adapters/`, BLoCs hold all business/merge
  logic, widgets stay presentation-only.
- Match the existing Dashboard vertical slice's conventions exactly (traced in full during planning):
  plain `Future<T>` ports with thrown `ApiException`, hand-parsed JSON in thin adapters (no
  codegen/DTOs), `flutter_bloc` with `part`-file event/state and a `status` enum + `copyWith`
  sentinel pattern, screen-level `BlocProvider` pulling a `registerFactory` bloc from `get_it`,
  `Navigator.push(MaterialPageRoute(...))` (no router package).
- Prefer `lib/ui/design_system/` widgets (`GlassContainer`, `WobblioButton`, `WobblioBadge`,
  `WobblioTag`, `WobblioInput`, `MerchantIcon`, `Avatar`, `MetricCard`, `ProgressBar`) over ad-hoc
  Material widgets — `DashboardScreen` under-uses them today; don't copy that part.
- `fvm flutter analyze` (0 issues) + `fvm flutter test` (green) before marking a slice done.
- Reuse existing ports/models where the underlying HTTP contract is already implemented (e.g.
  `InvoiceDetail` from `lib/core/ingestion/invoice_detail.dart`, already used by
  `IReviewRepository`) rather than duplicating a domain model — see `18b` for the specific reuse
  decision and why the new methods still land on a different port.
