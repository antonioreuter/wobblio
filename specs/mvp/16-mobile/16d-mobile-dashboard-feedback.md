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
- [ ] Recent-invoices list with merchant avatar/name/date/total + status pill (shimmer/amber/green)
- [ ] Pull-to-refresh refetches invoices + usage
- [ ] Terminal-status polling in a BLoC (backoff, stops at terminal)
- [ ] Thumbs up/down optimistic → `POST /invoices/{id}/feedback`
- [ ] Thumbs-down 3-chip reason picker + optional free-text + shortcut to 16e correction
- [ ] Tag-filter chip row (reads existing tags; no vocabulary endpoint)
- [ ] `DashboardBloc` unit tests (mocked ports); `flutter analyze` clean

## Verification
- List renders from `GET /invoices`; a freshly captured row transitions
  Processing → Parsed/Needs-review as polling observes the worker.
- Thumbs-down writes an `invoice_feedback` row with the chosen reason; UI updates optimistically and
  rolls back on error.
- Selecting a tag chip filters the list client-visible results.
