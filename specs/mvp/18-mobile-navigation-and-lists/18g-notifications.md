# 18g — Notifications

**Mobile epic | Parent: [18](../18-mobile-navigation-and-lists.md) · Tracker: [18-00](./18-00-handoff.md)**

New screen `ui/notifications/notifications_screen.dart`, reached from a net-new bell icon on
`DashboardScreen`'s `AppBar`. Depends on `18a`.

## Backend contract (`Source/backend/src/handlers/api-handler/notificationRoutes.ts`)

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` | `{ notifications: NotificationView[] }`. RLS-scoped to the caller, non-expired/active only (already-read notifications past their TTL are pruned server-side, not filtered client-side). |
| POST | `/notifications/{id}/read` | 204. Idempotent — marking an already-read notification read again is a no-op on the backend. |

`NotificationView { id, kind, title, body, budgetId: string|null, readAt: string|null, createdAt:
string }`. `kind` is a free-form string; `AlertKind` in `Source/backend/src/core/domain/budget.ts`
currently only emits `'BUDGET_85' | 'BUDGET_100'`, but the UI must not switch exhaustively on it —
an unrecognized future kind still needs a sensible default icon/tone rather than crashing or
rendering nothing.

## Scope

### Domain model (`lib/core/notifications/app_notification.dart`)
`AppNotification` mirrors `NotificationView` field-for-field, plain immutable `Equatable` class.
`isUnread` getter (`readAt == null`) is the single source of truth the bloc/screen both read.

### Port (`lib/core/ports/notification_repository.dart`)
`INotificationRepository`: `list()`, `markRead(String id)`. Plain `Future<T>` methods, thrown
`ApiException` on failure — no bespoke error types needed, there's no premium gate or 403 path on
this feature.

### Adapter (`lib/infrastructure/adapters/http_notification_repository.dart`)
Wraps the two `/notifications...` endpoints, hand-parsed JSON, no codegen — same shape as
`HttpShoppingListRepository`.

### `NotificationBloc` (`lib/core/bloc/notifications/`)
- `NotificationStatus { loading, ready, empty, failure }`.
- Events: `NotificationsStarted`, `NotificationsRefreshed`, `NotificationMarkedRead(id)`,
  `NotificationsMarkAllReadRequested`.
- Mark-read is **optimistic**: the tapped item's `readAt` flips to `DateTime.now()` immediately, the
  `markRead` call fires in the background, and on failure only that item's `readAt` is reverted to
  `null` — looked up fresh against `state.items` at failure time, not a snapshot captured at handler
  entry. This mirrors `ShoppingListBloc._onItemToggled`'s revert (`18-00-handoff.md`'s post-review
  fix #1): `flutter_bloc` processes events concurrently by default, so a slow-failing mark-read for
  one card must not clobber a different card's already-succeeded mark-read that completed in
  between.
- Mark-all-read is the same idea generalized to a set: every currently-unread id is flipped
  optimistically in one emit, then `markRead` fires for all of them via `Future.wait` with
  per-call error collection (no `Future.wait`'s default fail-fast — one failing call must not abort
  the others). If any calls fail, **only the failed ids** are reverted to unread in a second emit
  (again looked up fresh against `state.items`, not the pre-mark-all snapshot); the ones that
  succeeded stay marked read. A partial failure surfaces a single toast notice covering the whole
  batch rather than one per failed item.
- `notice` is cleared in the same emit that applies the optimistic mutation for both mark-read
  events, matching the "clear notice at the start of every retryable action" idiom
  `18-00-handoff.md`'s post-review fixes describe for Shopping List/Invoice Detail/Budgets.
- `NotificationState.hasUnread` (computed) drives whether "Mark all read" renders at all.

### `formatRelativeTime` (`lib/ui/format.dart`)
New pure function alongside the existing `formatMoney`: `"Xm"`/`"Xh"` under a day old, `"1d"` for
exactly one day, a weekday abbreviation (`"Mon"`) from two days up to a week old, and a short
`"MMM d"` date beyond that. No `intl` dependency — this app doesn't use one anywhere else, so the
weekday/month abbreviation tables are hand-rolled 7/12-element const arrays rather than pulling in a
new package for two lookup tables. Falls back to `'?'` for an unparsable timestamp instead of
throwing (display-only, never blocks rendering a card).

### `NotificationsScreen` (`lib/ui/notifications/notifications_screen.dart`)
- `BlocConsumer` (not `BlocBuilder`) for the notice → `SnackBar` handling, per `18-00-handoff.md`'s
  post-review fix #4 — a refresh or mark-read failure must actually surface, not just update state
  silently.
- Header: title + "Mark all read" `TextButton`, rendered only when `state.hasUnread` (no
  disabled-but-visible state — an unread-free list has nothing useful for the button to do).
- Loading/failure/empty states mirror Shopping List's `_RetryMessage`/`_EmptyState` pattern exactly.
- Cards: `GlassContainer` per notification — a tone-tinted icon square (kind → icon/color: `BUDGET_100`
  → danger `error_outline`, `BUDGET_85` → warning `warning_amber_outlined`, anything else → brand
  `info_outline`, the required default for an unrecognized future kind), bold title, relative time
  (`formatRelativeTime(createdAt)`), body text, and a small unread dot. Tapping an **unread** card
  dispatches `NotificationMarkedRead`; a read card is inert (no re-tap, no re-fire).
- Uses plain Material `Icons.*`, matching every other 18a–18f screen's icon usage (`flutter_lucide`
  is only used inside `MerchantIcon` today — this screen doesn't introduce a second convention).

### Nav
`DashboardScreen`'s `AppBar.actions` gains a net-new `_NotificationsButton` (bell icon,
`Icons.notifications_none`) between the existing `_UsagePill` and `_AccountButton` (18f), pushing
`NotificationsScreen`. **No unread-count badge in this slice** — explicitly deferred per the
approved plan; the icon alone is the v1 entry point.

## Testing

`test/bloc/notification_bloc_test.dart`, hand-rolled `_FakeNotifications` fake: loading→ready,
empty, failure, mark-one optimistic success, a slow-failing mark-read that reverts only its own item
without clobbering a concurrent, already-succeeded mark-read of a different item (mirrors the
Shopping List regression test for the identical race), mark-all-read success, mark-all-read partial
failure (verifies the split — succeeded ids stay read, failed ids revert, notice is set), and
mark-all-read as a no-op when nothing is unread (no `markRead` calls at all).

## Verification

- `fvm flutter analyze` → 0 issues.
- `fvm flutter test test/bloc/` → all green (7 new tests in `notification_bloc_test.dart`).
