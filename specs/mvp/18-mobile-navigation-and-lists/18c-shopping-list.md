# 18c — Shopping List

**Mobile epic | Parent: [18](../18-mobile-navigation-and-lists.md) · Tracker: [18-00](./18-00-handoff.md)**

New screen `ui/shopping_list/shopping_list_screen.dart`. Depends on `18a`.

## Backend contracts (`Source/backend/src/handlers/api-handler/listRoutes.ts`)

| Method | Path | Notes |
|---|---|---|
| GET | `/lists` | `{ lists: ListSummary[] }`, `ListSummary { id, name, categoryId, itemCount, createdAt }` |
| GET | `/lists/{id}` | `ListDetail { id, name, categoryId, regionCode, countryCode, isActive, createdAt, completedAt, items: ListItem[] }`, `ListItem { id, freeText, productId, checked, quantity, position, updatedAt }` |
| POST | `/lists` | `{ name, categoryId }` → `{ id }`. `categoryId` is `'cat-groceries'` \| `'cat-personal-care'`, **immutable after creation** ("category lock"). Active-list cap: 3 (STANDARD) / 10 (PREMIUM+) |
| POST | `/lists/{id}/items` | `{ freeText, productId?, quantity? }` → `{ id }` |
| PATCH | `/lists/{id}/items/{itemId}` | partial `{ checked?, freeText?, productId?, quantity? }` |
| DELETE | `/lists/{id}/items/{itemId}` | |
| POST | `/lists/{id}/optimize` | **Premium-gated** (403 for STANDARD). `{ excludedMerchantIds?: string[] }` → `OptimizationResult` |
| POST | `/lists/{id}/share` | `{ shareId, url, expiresAt }` |

`OptimizationResult { optimized, baseline: {merchantId,name,total}|null, totalExpectedSaving, stores: StoreSubList[], unresolvedItems: string[], reason: string|null }`
`StoreSubList { merchantId, name, isPrimary, subtotal, lines: StoreLine[] }`
`StoreLine { productId, displayName, expectedPrice, quantity, lineTotal, observationCount, lastObservedOn, confidence }`

## Resolved conflict: shopping lists are per-user, not household-scoped

The design-folder read initially assumed household scoping (matching the shopping-list optimizer's
household framing elsewhere in the spec corpus). Verified otherwise: `shopping_list.tenant_id`
references `app_user(id)` directly (migration `20260611152000_initial_schema.ts`), the RLS policy is
scoped to `app.current_tenant_id` (the individual user), and `IShoppingListRepository` /
`ShoppingListRepositoryAdapter` / the webapp's `lists` page have zero `household` references. **No
household picker is built here.** `GET /lists` returns only the caller's own lists.

## Resolved conflict: `OptimizationResult` has no item id

`StoreLine` carries `productId`, not the list item's own `id`. Merging the optimizer's store-grouped
view with the live `ListItem[]` (source of truth for `checked`/`quantity`/CRUD) must join on
`productId`; items with `productId == null` (free-text, unresolved) render ungrouped per
`unresolvedItems`, not silently dropped.

## Scope

### Domain models (new `lib/core/lists/` family)
`ShoppingListSummary`, `ShoppingListDetail`, `ShoppingListItem`, `OptimizationResult`, `StoreSubList`,
`StoreLine` — mirror the backend shapes above field-for-field, plain immutable `Equatable` classes.

### Port (`lib/core/ports/shopping_list_repository.dart`, `IShoppingListRepository`)
`list()`, `getDetail(id)`, `create(name, categoryId)`, `addItem(listId, freeText, productId?,
quantity?)`, `updateItem(listId, itemId, {checked?, freeText?, productId?, quantity?})`,
`removeItem(listId, itemId)`, `optimize(listId, excludedMerchantIds)`.

### Adapter (`lib/infrastructure/adapters/http_shopping_list_repository.dart`)
Wraps the 7 endpoints above. `optimize()` must let a 403 (`ApiException` with `statusCode: 403`)
propagate distinctly so the bloc can catch it specifically rather than treating it as a generic
load failure.

### `ShoppingListBloc` (`lib/core/bloc/shopping_list/`)
- On start: `list()`. If no active list exists, expose a "create list" affordance (category choice:
  Groceries / Drugstores per `SHOPPING_LIST_CATEGORY_IDS`); otherwise load the first active list's
  detail.
- Holds `ListDetail.items` as the live source of truth for checked/quantity/CRUD.
- Separately attempts `optimize()` (Premium accounts only — if the app doesn't already expose role
  client-side, check `ProfileRepository`/`UsageRepository` first rather than guessing; if role isn't
  available, just attempt the call and catch the 403). On success, derives a merged "grouped by
  store" view (join `StoreLine.productId` against live items for the checked/quantity overlay). On
  403 or any optimize failure, falls back to a flat, ungrouped checklist — no split-route banner.
  **This merge/fallback logic is the core of this slice and must live entirely in the bloc.**
- Item CRUD events (add/toggle/remove) call the port directly and refresh state; no optimistic UI
  needed for v1 (matches the simplicity of existing screens — add if a follow-up needs it).

### `ShoppingListScreen`
- "Shopping list" title + "Add item" (`WobblioButton`, opens a simple text input), item-count/store-
  count subheader.
- Split-route savings banner (`GlassContainer`, success-tinted) — only when `optimized: true` and the
  optimize call succeeded.
- Per-store subtotal chips using `MerchantIcon`'s existing brand-color lookup + numbered badge.
- Checkable item rows: `WobblioCheckbox`-style tap target, strike-through + muted color when checked,
  store-color dot + qty/store line, trailing tabular-nums price.
- "Estimated total" footer row.
- Empty state: "create your first list" affordance when `list()` returns nothing.

## Out of scope

- Household picker (lists are per-user — see above).
- Region override UI (`PATCH /lists/{id}/region`, Premium-only) — not part of this screen's v1.
- Store-exclusion UI (`excludedMerchantIds` param exists on `optimize()`; v1 always calls with an
  empty list — add an exclusion UI as a follow-up once the base merge logic is proven).
- Share link UI (`POST /lists/{id}/share` exists; not wired in this slice).
- List switcher (v1 shows the single first active list, matching the mockup's single-list focus).

## Checklist

- [ ] Domain models + `IShoppingListRepository` + `HttpShoppingListRepository`
- [ ] `ShoppingListBloc`: list/create/item-CRUD + optimize-with-graceful-403-fallback merge logic
- [ ] `ShoppingListScreen`: add item, savings banner (Premium + optimized only), store chips,
      checkable rows, estimated total, empty state
- [ ] `fvm flutter analyze` → 0 issues; `fvm flutter test` → green (new `shopping_list_bloc_test.dart`
      covering both the Premium-optimized-merge path and the STANDARD/403-fallback path)
