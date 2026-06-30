# 16d — Dashboard & Feedback

**Mobile epic | Parent: [16](../16-mobile-capture-and-review.md) · Tracker: [16-00](./16-00-handoff.md)**

The mobile home: the recent-invoices list with live status pills, pull-to-refresh, terminal-status
polling, the thumbs up/down accuracy affordance, and a tag-filter chip row.

## Dependencies
- [16c](./16c-mobile-capture.md) (PROCESSING rows are inserted here)
- [07](../07-core-ingestion-pipeline.md) / [08](../08-data-intelligence-layer.md) (`GET /invoices`, feedback, tags)

## Scope
- **Recent-invoices list** from `GET /invoices`: merchant avatar + name, date, total (tabular
  figures), and a **status pill** — `Processing…` shimmer, `Needs review` amber tap-target,
  `Parsed` green. Mirror the webapp `invoice-table.tsx` status mapping.
- **Pull-to-refresh** (`RefreshIndicator`) refetching invoices + `/me/usage`.
- **Terminal-status polling**: after capture, poll `GET /invoices/{id}` (or the list) on a backoff
  (webapp uses 2.5s / 5s / 9s) until the row reaches a terminal status, then stop. Done in a BLoC,
  not in widgets.
- **Thumbs up/down** on the invoice card: optimistic state update → `POST /invoices/{id}/feedback`
  `{ verdict: 'UP' | 'DOWN' }`; on `DOWN`, open a **3-chip reason picker** + optional free-text and
  a shortcut into the correction screen (16e). Persists to `invoice_feedback`.
- **Tag filter**: horizontally scrolling chip row above the list, filtering by tags already present
  on the user's invoices (`search_tags && ARRAY[...]`, GIN-backed; free tier 2-month window). This
  is the **read** side — it needs **no** tag-vocabulary endpoint (that's 16h's add-tag picker).
- `DashboardBloc` owns list/filter/poll state.

## Reuse references
- `Source/webapp/src/components/workspace/invoice-table.tsx` (columns, status badge colors).
- `Source/webapp/src/components/workspace/workspace-provider.tsx` (poll cadence, optimistic
  feedback/delete patterns).
- `Source/webapp/src/lib/invoice-map.ts` (backend → client status mapping).

## Out of scope
- The correction screen itself (16e) — the thumbs-down shortcut just navigates to it.
- Add-tag picker / merchant edit (16h).

## Checklist
- [x] Recent-invoices list with merchant avatar/name/date/total + status pill (shimmer/amber/green)
      — `DashboardScreen` cards: `CircleAvatar` initial, merchant, date, total (tabular via
      `AppTheme.money`), `_StatusPill` with a spinner for PROCESSING.
- [x] Pull-to-refresh refetches invoices + usage — `RefreshIndicator` → `DashboardRefreshed`
      (refetches `GET /invoices` + `GET /me/usage`); usage shown as an app-bar "N left" pill.
- [x] Terminal-status polling in a BLoC (backoff, stops at terminal) — `_DashboardPollRequested`
      ramps the webapp cadence (2.5s/5s/9s) then **holds at the last interval until terminal** (spec
      says "until the row reaches a terminal status", stronger than the webapp's fixed 3 shots),
      bounded by `maxPollAttempts` (~5.5 min) so a stuck row can't poll forever. Stops when no row is
      `PROCESSING`; a newer refresh supersedes an in-flight loop (generation guard, re-checked after
      every await). Schedule + cap are injectable for tests.
- [x] Thumbs up/down optimistic → `POST /invoices/{id}/feedback` — `DashboardFeedbackSubmitted`
      sets the verdict immediately, persists, reverts + notices on failure.
- [~] Thumbs-down reason picker — **verdict-only shipped; reason picker deferred to a backend change.**
      The backend `/feedback` + `invoice_feedback` store only `{ verdict }` (no reason/notes column),
      so a 3-chip picker would silently drop data. Thumbs-down instead offers a **"Fix details"
      shortcut to the 16e correction screen** (placeholder until 16e). See handoff gap.
- [x] Tag-filter chip row (reads existing tags; no vocabulary endpoint) — horizontal `ChoiceChip`
      row from the tags present on loaded invoices; **client-side** filter (the list endpoint takes
      no tag query param). Reselect clears.
- [x] `DashboardBloc` unit tests (mocked ports); `flutter analyze` clean — `dashboard_bloc_test.dart`
      (load/usage-failure/poll-to-terminal/no-poll/tag-filter/optimistic-feedback+revert/refresh);
      `fvm flutter analyze` → 0, `fvm flutter test` → green (35).

> **Status-pill note:** `NEEDS_REVIEW` collapses into the green **"Ready"** pill, matching the
> canonical webapp `invoice-map.ts` (no user action flips it → an amber "needs review" badge would
> imply an unfinishable task). The 16e correction screen is still reachable via row tap / thumbs-down.

## Verification
- [x] List renders from `GET /invoices`; a freshly captured row polls Processing → Parsed and stops
      (unit-tested with an injected zero-delay schedule).
- [ ] **Pending on-device:** thumbs-down writes an `invoice_feedback` row (verdict) and rolls back on
      error against the **dev** backend; selecting a tag chip filters the visible list; pull-to-refresh
      updates list + usage. (Automated gates above are green.)
