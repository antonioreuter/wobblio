# 08.01 — Add product-item leaves under the venue macros

**Goal.** Give `cat-dining-out` and `cat-bars-pubs` real product-item leaves so that
venue-served food and drink line items have a valid, specific home instead of falling into
grocery leaves. This is the keystone change; sub-specs 02–04 depend on the leaf ids defined
here.

## New leaves (per DEC-2 — confirm granularity before building)

Recommended set:

| id | name | parentId |
|----|------|----------|
| `cat-dining-meals` | Meals & Dishes | `cat-dining-out` |
| `cat-dining-drinks` | Drinks | `cat-dining-out` |
| `cat-dining-snacks` | Snacks & Sides | `cat-dining-out` |
| `cat-bar-drinks` | Drinks | `cat-bars-pubs` |
| `cat-bar-food` | Bar Food | `cat-bars-pubs` |

The existing `*-tax`, `*-discount`, `*-other`, `*-deposit` structural leaves for both macros
stay exactly as they are — `depositCategoryFor()` / `discountCategoryFor()` already derive
`cat-dining-out-deposit` etc. and require no change.

## Changes (all sync copies — see handoff "Sync points")

1. **Backend taxonomy** — `Source/backend/src/core/domain/categoryTaxonomy.ts`
   Insert the five `CategoryDefinition` rows near the dining-out / bars-pubs groupings.
   `CATEGORY_IDS`, `macroCategoryId`, `categoryIdsUnderMacro`, `isValidCategoryId` all derive
   from `CATEGORY_TAXONOMY`, so they pick the leaves up automatically — no helper edits.

2. **Local dev seed** — `Source/infra/src/local/seeds/product-taxonomy.ts`
   Add the identical five rows (must byte-match the migration + backend list).

3. **Migration (DDL)** — new file
   `Source/infra/src/migrations/<next-ts>_add_dining_out_and_bar_leaves.ts`
   (timestamp after `20260709120000`; suggested `20260710120000`). Follow the pattern of
   `20260619120000_expand_grocery_categories.ts`: export a `CategoryRow[]`, `INSERT INTO
   product_category (id, name, parent_id) VALUES … ON CONFLICT (id) DO NOTHING` in `up`,
   and delete-by-id in `down`. Idempotent so it is safe to re-run.

4. **Webapp icon map** — `Source/webapp/src/components/ds/CategoryIcon.tsx`
   Add the five leaf ids to `CATEGORY_PARENTS` mapping each to its macro
   (`cat-dining-*` → `cat-dining-out`, `cat-bar-*` → `cat-bars-pubs`). The macro already has an
   icon in `CATEGORY_ICON_MAP`, so leaves inherit it — no new icon needed. Display names come
   from the backend `GET /reference/categories` response.

## Out of scope

- No changes to budget/spend/report SQL (macro rollup already correct — see handoff blast radius).
- No prompt changes here (sub-spec 02).
- No merchant seeds here (sub-spec 03).

## Acceptance

- [ ] `cd Source/backend && npm run test:unit` passes, including
  `categoryTaxonomy.test.ts` with the new ids.
- [ ] `cd Source/infra && npm test` passes `seed_reference_data.test.ts`
  (every backend taxonomy id present in the migration snapshot; counts match).
- [ ] Migration applies cleanly against the local dev DB and is idempotent on re-run
  (`ON CONFLICT DO NOTHING`).
- [ ] `macroCategoryId('cat-dining-meals') === 'cat-dining-out'` and
  `macroCategoryId('cat-bar-drinks') === 'cat-bars-pubs'` (add to the taxonomy unit test).
- [ ] Webapp typecheck/build passes with the new `CATEGORY_PARENTS` entries.
