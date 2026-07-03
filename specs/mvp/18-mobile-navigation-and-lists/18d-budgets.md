# 18d — Budgets

**Mobile epic | Parent: [18](../18-mobile-navigation-and-lists.md) · Tracker: [18-00](./18-00-handoff.md)**

New screen `ui/budgets/budgets_screen.dart`. Depends on `18a`. Not wired into any nav in this
slice — the entry point (a row on the Account screen) lands in `18f`; until then the screen is
reachable only by pushing it directly (e.g. from a debug menu or a future caller).

## Backend contracts (`Source/backend/src/handlers/api-handler/budgetRoutes.ts`)

| Method | Path | Notes |
|---|---|---|
| GET | `/budgets` | `{ budgets: BudgetView[] }`. **Not premium-gated** — any authenticated caller can list (an empty list for a STANDARD account that has never had one, or a downgraded account's old rows). |
| POST | `/budgets` | `{ scope, categoryId, memberUserId, amount, period }` → 201 `BudgetView`. Premium-gated (`PremiumRequiredError` → 403); also 403 (`NotHouseholdOwnerError`) for a household member who isn't the owner, **regardless of scope**; 400 (`InvalidBudgetError`) for a bad scope/period/amount or a missing `categoryId`/`memberUserId` for `CATEGORY`/`MEMBER`; 409 (`BudgetLimitError`) at 10 budgets per tenant. |
| PATCH | `/budgets/{id}` | partial `{ amount?, period? }` → `{ updated: true }`. 400 invalid, 404 unknown id. |
| DELETE | `/budgets/{id}` | 204. 404 unknown id. |

`BudgetView { id, scope: 'TOTAL'|'CATEGORY'|'MEMBER'|'HOUSEHOLD', categoryId: string|null,
memberUserId: string|null, amount: number, period: 'DAY'|'WEEK'|'MONTH', accumulated: number,
alert85Fired: boolean, alert100Fired: boolean, alert85At: string|null, alert100At: string|null,
cycleStart: string }`. `accumulated` is live (recomputed on every `GET`, not the cron's stale
snapshot).

Also used: `GET /reference/categories` → `{ categories: [{ id, name, parentId }] }` (the bundled
macro/sub category taxonomy, already consumed by the webapp's `useBudgetReference`).

## Resolved conflict: the "forbidden" (non-premium) screen state is decided client-side, not from a 403

`GET /budgets` has no premium gate — only `POST` does. If the bloc simply called `list()` and waited
for a 403 to show the upsell card, a STANDARD account would instead see a (correctly) empty list with
no explanation of why they can't add one. Mirroring `ShoppingListBloc`'s `_safeIsPremium` fail-closed
pattern, `BudgetBloc` resolves premium status from `IProfileRepository.fetchProfile().role` **before**
deciding whether to call `list()` at all: non-premium always renders the upsell card (`forbidden`
status), regardless of whether the account happens to have old budget rows from before a downgrade.
A 403 encountered later, mid-session, on a *mutation* (most commonly `NotHouseholdOwnerError` for a
non-owner household member — see the table above, this fires for `TOTAL`/`CATEGORY` too, not just
`MEMBER`/`HOUSEHOLD`) surfaces as a toast notice instead, since the already-loaded budget list is
still valid to show.

## Resolved conflict: `MEMBER`/`HOUSEHOLD` budgets have no mobile-buildable create/edit UI

Creating a `MEMBER` budget needs a household roster picker; `HOUSEHOLD` needs household-owner
context. Neither port exists on mobile yet (see `18c`'s note that shopping lists are per-user, and
no household screen has landed in any mobile slice so far). Per the approved plan: **v1's create
form only offers `TOTAL`/`CATEGORY` scope.** Any pre-existing `MEMBER`/`HOUSEHOLD` budget (created via
the webapp) still lists on mobile, but read-only — `Budget.isEditable` is `false` for those two
scopes, the row shows a generic label ("Household member budget" / "Household budget", since mobile
has no roster to resolve a real name from) and no edit/delete affordance.

## Scope

### Domain model (`lib/core/budgets/budget.dart`)
`Budget` mirrors `BudgetView` field-for-field, plain immutable `Equatable` class. `isEditable` getter
(`scope == 'TOTAL' || scope == 'CATEGORY'`) is the single source of truth the bloc/screen both read
to decide whether to offer edit/delete.

### Reference domain model (`lib/core/reference/category.dart`)
`Category { id, name }` — only the two fields the budget category picker needs.

### Ports
- `lib/core/ports/budget_repository.dart` (`IBudgetRepository`): `list()`, `create(NewBudget)`,
  `update(id, BudgetPatch)`, `remove(id)`. `NewBudget`/`BudgetPatch` are plain request DTOs mirroring
  the backend's `NewBudget`/`BudgetPatch` shapes.
- `lib/core/ports/reference_repository.dart` (`IReferenceRepository`): `fetchCategories()`.

### Adapters
- `lib/infrastructure/adapters/http_budget_repository.dart` wraps the 4 `/budgets...` endpoints.
- `lib/infrastructure/adapters/http_reference_repository.dart` wraps `GET /reference/categories`.

### `BudgetBloc` (`lib/core/bloc/budgets/`)
- `BudgetStatus { loading, ready, empty, forbidden, failure }` — `forbidden` is the non-premium
  upsell state, distinct from `failure` (a retryable load error).
- Events: `BudgetsStarted`, `BudgetsRefreshed`, `BudgetCreateRequested`, `BudgetUpdateRequested`,
  `BudgetDeleteRequested`.
- On start/refresh: resolve premium status (see resolved conflict above); non-premium → `forbidden`
  immediately, no `list()` call. Premium → `list()` + `fetchCategories()` (best-effort — a category
  fetch failure degrades to an empty name map rather than failing the whole load, since category
  labels are cosmetic).
- `notice` is cleared at the start of every retryable mutation (create/update/delete), matching the
  idiom `18-00-handoff.md`'s post-review fixes describe for Shopping List/Invoice Detail, so two
  consecutive identical-text failures aren't silently deduped by `bloc`'s emit-equality check.
- Every mutation success reloads the full list (`_load`) rather than patching state locally —
  budgets are capped at 10 per tenant, so a full reload is cheap, and `accumulated`/`cycleStart` are
  server-computed values a client-side patch could never derive correctly anyway.
- `BudgetState` exposes computed `List<BudgetRowView> rows` (one per budget: `progressPct =
  (accumulated / amount * 100).clamp(0, 999)`, `overCap = accumulated > amount`, a resolved
  `categoryLabel` via the loaded category-name map for `CATEGORY` scope, or a fixed label for
  `TOTAL`/`MEMBER`/`HOUSEHOLD`) and `hasOverCapBudget` for the warning banner.

### `BudgetsScreen`
- Header ("Budgets" + count) + "New budget" button (`WobblioButton`, opens a dialog).
- Non-premium (`forbidden`): a `GlassContainer` upsell card instead of the list — no budgets fetch
  attempted, nothing to retry.
- Over-cap warning banner (`GlassContainer`, danger-tinted) when `hasOverCapBudget`.
- Rows: `GlassContainer` per budget, `ProgressBar` (danger tone auto-selects ≥85% per its own
  thresholds), amount/accumulated line, `WobblioBadge` for scope, edit/delete icon buttons only when
  `row.isEditable`.
- Create/edit dialog: scope selector (`SegmentedButton`, `TOTAL`/`CATEGORY` only, hidden entirely when
  editing — scope is immutable after creation, matching the backend's `BudgetPatch` having no `scope`
  field), category picker (`DropdownButton`, shown only when scope is `CATEGORY`, populated from
  `IReferenceRepository` via the bloc's loaded `categoryNames`), amount (`WobblioInput`, numeric),
  period selector (`SegmentedButton`, `DAY`/`WEEK`/`MONTH`).
- Delete: confirm dialog mirroring `InvoiceDetailScreen._confirmDelete`'s pattern.
- Empty state (premium, zero budgets): "Create a budget" affordance.

## Out of scope

- `MEMBER`/`HOUSEHOLD` budget creation/edit (see resolved conflict above) — read-only display only.
- Nav wiring (`18f` adds the Account-screen entry point).
- Notification bell / 85%/100% alert surfacing (`18g`).

## Checklist

- [x] Domain models (`Budget`, `Category`) + `IBudgetRepository`/`HttpBudgetRepository` +
      `IReferenceRepository`/`HttpReferenceRepository`
- [x] `BudgetBloc`: client-side premium gate, list/create/update/delete, computed
      progress/overCap/categoryLabel, notice-reset-before-retry
- [x] `BudgetsScreen`: upsell card, over-cap banner, rows with edit/delete gated by `isEditable`,
      create/edit dialog, empty state
- [x] DI wiring in `main.dart` (18d block)
- [x] `fvm flutter analyze` → 0 issues; `fvm flutter test test/bloc/` → green (new
      `budget_bloc_test.dart`)
