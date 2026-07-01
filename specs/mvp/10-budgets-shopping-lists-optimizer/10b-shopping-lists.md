# 10b — Shopping Lists

**Epic 8 | Phase 4 | Premium feature core (list CRUD itself is free-tier; store-grouping in [10c](./10c-split-route-optimizer.md) is Premium)**

## Overview

Shopping list creation and item management. A list is scoped to one expense category — Groceries or Drugstores — chosen once at creation, which constrains product search to that category for the lifetime of the list. Lists support per-item quantity, offline mobile sync, and sharing via a public weblink (copy or WhatsApp) with buy-checkboxes the recipient can tick without an account. The list is the input to the [Split-Route Optimizer](./10c-split-route-optimizer.md).

## Dependencies

- [04 — Authentication & Waitlist](../04-authentication-waitlist.md)
- [08 — Data Intelligence Layer](../08-data-intelligence-layer.md) (product catalog + category taxonomy)
- [10c — Split-Route Optimizer](./10c-split-route-optimizer.md) (consumes list items)

## List Creation & Category Lock

- A list is created with a `name` and a required `category_id` — exactly one of `cat-groceries` (Groceries) or `cat-personal-care` (Drugstores — the taxonomy's "Personal Care & Pharmacy" macro is the Drugstore bucket; there is no separate `cat-drugstore` macro). Single-select, **immutable after creation** — start a new list to shop a different category.
- Item search (autocomplete) on a list only returns products whose category rolls up to the list's `category_id` macro (macro id itself, or any leaf under it — e.g. a Groceries list surfaces `cat-dairy`, `cat-produce`, `cat-groceries` items but never `cat-personal-care` or unrelated-macro items). Products outside both macros are never searchable from a list, regardless of which list is open.
- Free-text items (no resolved product) are exempt from the category filter — a shopper can always jot something the catalog doesn't have yet, matching the existing free-text behavior.

## Quota

- 3 active lists (STANDARD) / 10 active lists (PREMIUM) — enforced on creation. Unchanged from the pre-refactor spec.

## Item Fields

- `free_text` + optional resolved `product_id` (from category-scoped autocomplete against the product table)
- `quantity` — integer ≥ 1, default 1, editable after adding. Feeds the optimizer's per-line and per-store totals (see [10c](./10c-split-route-optimizer.md)).
- `checked` — boolean, toggleable both from the authenticated list view and from a public share link.

Autocomplete searches: `ACTIVE` global products ∪ tenant's own PROVISIONAL products (§6.8), filtered to the list's category as above.

## Premium Region Override

- By default, item search and (in [10c](./10c-split-route-optimizer.md)) store-grouping use the shopper's own profile region (`app_user.region_code`, falling back to `country_code`).
- **PREMIUM** users may override this per list — set once (or change later) so the whole list always prices/searches against a chosen region/country instead of their own. Persisted on the list (`shopping_list.region_code`, `shopping_list.country_code`), not a one-off toggle.
- **STANDARD** users cannot set an override — any attempt is rejected server-side (403), not silently ignored. Their lists always use their profile region.

## Sharing (Weblink + WhatsApp)

- Any list (any tier) can be shared via an unguessable weblink — no login required to open it.
- Share creation issues a token (hashed for lookup, KMS-encrypted at rest per invariant #9, 7-day TTL, revocable) and returns a URL: `{WEB_APP_URL}/shared-lists/{token}`.
- The public share view shows the list name and items (free text, quantity, checked state) — **no pricing, no optimizer data, no productId**. The only write the public view can perform is toggling an item's `checked` box, so someone shopping on your behalf can mark off what they bought.
- Share via "Copy link" (clipboard) or a WhatsApp button (`wa.me` deep link prefilled with the list name + URL) — no separate text-summary export; the link itself is the shared artifact, and it stays live/interactive (checkbox state) rather than a static snapshot.
- A list owner can revoke an active share link at any time.

## Offline Support (Mobile)

- Locally encrypted cache of list items; check-off persists offline; sync on reconnect; last-write-wins per item. Unchanged from the pre-refactor spec — deferred to the Epic 16 Flutter build (`Source/mobile/` does not exist yet).

## Completion

- Completed list: set `is_active = false`, `completed_at = now()`. Unchanged.

---

## Checklist

### Shopping List Endpoints
- [x] `POST /lists` — create list (enforce active limit by role) — extend body with required `categoryId`
- [x] `GET /lists` — list active lists with item counts — response gains `categoryId`, `regionCode`, `countryCode`
- [x] `GET /lists/{id}` — list detail with all items — items gain `quantity`
- [x] `POST /lists/{id}/items` — add item (free_text + optional product search) — extend body with optional `quantity` (default 1)
- [x] `PATCH /lists/{id}/items/{item_id}` — update item (check, uncheck, edit text/product) — extend with optional `quantity`
- [x] `DELETE /lists/{id}/items/{item_id}` — remove item
- [x] `POST /lists/{id}/complete` — mark list complete
- [ ] `PATCH /lists/{id}/region` — set/clear the Premium region override (403 for STANDARD)

### Product Autocomplete
- [x] `GET /products/search?q=...` — search ACTIVE products ∪ tenant's own PROVISIONAL products
- [x] Trgm-based fuzzy search for partial match (e.g., "melk" → "Halfvolle Melk")
- [x] Return: product_id, display_name, brand, category, pack size
- [ ] Optional `?category=cat-groceries|cat-personal-care` param — server-side macro rollup filter, sent only by the shopping-list add-item UI

### Sharing
- [ ] `POST /lists/{id}/share` — issue a share link (token, KMS-encrypted at rest, 7-day TTL)
- [ ] `DELETE /lists/{id}/share/{shareId}` — revoke
- [ ] `GET /shared-lists/{token}` — public, unauthenticated: list name + items (free text, quantity, checked), no pricing/productId
- [ ] `PATCH /shared-lists/{token}/items/{itemId}` — public, unauthenticated: `{checked}` only
- [ ] Public share Lambda resolves `{listId, tenantId}` via a `SECURITY DEFINER` SQL function (mirrors `resolve_invoice_share`) — RLS is never bypassed, the token determines whose tenant scope the read/write runs under
- [ ] Webapp: sticky "Copy link" + WhatsApp share bar on the list detail screen
- [ ] Webapp: public `/shared-lists/[token]` page (no auth, no app shell) with checkbox toggling

### Shopping List Offline Support (Flutter)
- [ ] Local encrypted cache (Hive or similar) for list items — deferred to Epic 16 mobile build
- [ ] Offline check-off with timestamp
- [ ] Background sync on reconnect: last-write-wins per item based on `updated_at`
- [ ] Conflict resolution: optimistic lock or timestamp-based merge
- [ ] Visual sync status indicator
