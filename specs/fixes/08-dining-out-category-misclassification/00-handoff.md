# 08 — Dining-out category misclassification (living handoff)

Restaurant, fast-food, café, takeaway and bar purchases are being bucketed under
**Groceries** in the spend-breakdown report (and everywhere else that reads
`invoice_line.category_id`). A McDonald's receipt shows up "partially as groceries"
because its lines land in grocery leaves (`cat-ready-deli`, `cat-beverages`,
`cat-meat-fish`), which roll up to the `cat-groceries` macro.

This is a **structural** defect, not a one-off model hiccup — it affects *all*
venue-served consumption, not just this receipt.

---

## Root cause (two coupled defects)

**Defect A — the taxonomy has no product-item leaf under the venue macros.**
`cat-dining-out` and `cat-bars-pubs` carry only the four *structural* leaves every
macro gets — `*-tax`, `*-discount`, `*-other`, `*-deposit`
(`Source/backend/src/core/domain/categoryTaxonomy.ts:93-95,120-122,152,161`).
Meanwhile `cat-groceries` owns every food leaf (`cat-ready-deli`, `cat-meat-fish`,
`cat-beverages`, `cat-snacks`, `cat-bakery`, … `categoryTaxonomy.ts:29-45`).
The per-line product-expansion prompt is told to *"choose the **most specific** id"*
(`Source/backend/src/prompts/productExpansion.ts:14`), and for a burger / fries / cola
the most-specific *available* leaves are all grocery leaves. A served meal has literally
nowhere else to go.

**Defect B — the per-line model is blind to the venue.**
`ProductNormalizer.normalize(merchantId, lines, countryCode)` receives the merchant
(`ProductNormalizer.ts:44`) but `buildExpansionMessage` only sends
`<categories>`, `<tags>` and `<lines>` — **the merchant brand / venue type is never
passed to the LLM** (`ProductNormalizer.ts:54,176-181`), despite the prompt's own comment
claiming "the service supplies the merchant brand" (`productExpansion.ts:3`). So even if
dining-out leaves existed, the model can't tell a McDonald's "Big Mac" line from a
supermarket freezer ready-meal.

**How it surfaces in the report.** The spend-breakdown query aggregates by *line* category
rolled up to its macro — `COALESCE(pc.parent_id, l.category_id)`
(`Source/backend/src/infrastructure/adapters/reporting/SpendReportQueryAdapter.ts:32,40`).
It never consults `invoice.category_id`. So even a correctly classified dining-out *invoice*
still gets shredded into Groceries because its *lines* carry grocery leaves. Fixing the
invoice-level classifier alone would **not** fix the report — the lines must be fixed.

Downstream amplifier: the mis-category also degrades product matching — `searchByEmbedding`
filters candidates by `item.categoryId` (`ProductNormalizer.ts:77`), so a restaurant burger
gets matched against grocery meat products.

---

## The fix, in one paragraph

Give the venue macros real product leaves (Defect A), thread the merchant brand + the
best-known macro prior into the product-expansion call and teach the prompt to route
venue-served food/drink into those leaves (Defect B), and seed the common fast-food /
restaurant chains with a `cat-dining-out` merchant prior so the invoice-level classifier
and the per-line context agree. Budget/spend/report SQL already roll leaves up to their
macro, so no query changes are needed; price observations don't store category, so that
store is untouched.

---

## Sub-specs

| # | File | Blocks | Status |
|---|------|--------|--------|
| 01 | `01-taxonomy-dining-and-bar-leaves.md` | — | DONE |
| 02 | `02-merchant-context-in-product-expansion.md` | 01 | DONE |
| 03 | `03-restaurant-merchant-seeds.md` | 01 | DONE |
| 04 | `04-backfill-and-acceptance.md` | 01,02,03 | DONE (deterministic); live-Bedrock run + optional backfill pending |

## Where this stands (implemented 2026-07-10)

All four sub-specs are implemented and their gates are green:

- **01** — Added leaves `cat-dining-meals/-drinks/-snacks` (→ `cat-dining-out`) and `cat-bar-drinks/-food`
  (→ `cat-bars-pubs`) across backend `categoryTaxonomy.ts`, local seed `product-taxonomy.ts`, new migration
  `20260710120000_add_dining_out_and_bar_leaves.ts` (exports `VENUE_CATEGORIES`), the parity test, the backend
  taxonomy unit test, and webapp `CategoryIcon.tsx` `CATEGORY_PARENTS`.
- **02** — `MerchantResolution` now carries `defaultCategoryId`; `MerchantResolver` populates it on every path.
  `IProductNormalizer.normalize` takes an optional `MerchantExpansionContext` (brand + macro prior); the
  `InvoiceCoordinator` threads it in; `ProductNormalizer` emits a `<merchant .../>` hint into the expansion
  message (omitted for unknown merchants → legacy shape). Prompt bumped to `product-expansion/v4` with the
  venue-routing rule.
- **03** — New migration `20260710130000_seed_dining_merchants.ts` seeds 12 NL fast-food/restaurant chains
  (McDonald's, Burger King, KFC, Subway, Domino's, New York Pizza, FEBO, Starbucks, La Place, Kwalitaria,
  Pizza Hut, Smullers), all `cat-dining-out`, mirrored in the local merchant seed and pinned by
  `seed_merchants.test.ts`.
- **04** — Deterministic SQL-level acceptance added to `SpendReport.local.test.ts` and passing against local
  Postgres (migrations applied): a McDonald's-like invoice's meals/drinks/snacks report under **Dining Out**
  (11.5) with **Groceries unchanged (12.8)** — zero leakage — and reconcile at L2 (merchant) and L3 (leaves).

**Gates run:** backend `test:unit` 953/953 · `skill:hexagonal-architecture-validator` exit 0 ·
`validate:security` pass · infra suite 26 pass/6 skip (parity: categories + merchants) · webapp `tsc` clean ·
`test:integration SpendReport.local` 11/11.

**Remaining (needs live dev, not runnable here):** the live-Bedrock end-to-end run (ingest a real fast-food
receipt photo through vision→normalize→classify and confirm `cat-dining-*` line categories + the `dining-out`
tag) and the optional dev-only backfill of pre-existing mis-categorised invoices (DEC-4). Never touch prod.

## DAG

```
01 (taxonomy leaves) ──┬── 02 (merchant context + prompt v4)
                       ├── 03 (restaurant merchant seeds)
                       └──────────────┴── 04 (backfill + acceptance eval)
```

01 is the keystone — it must land first because 02 and 03 reference the new leaf ids and
the seed/parity tests will fail until all sync copies agree. 02 and 03 are independent of
each other. 04 verifies the whole chain end-to-end.

---

## Blast radius (verified — what does NOT change)

- **Budget spend** (`Source/infra/src/migrations/20260624130000_budget_category_hierarchy.ts:32`)
  groups by `COALESCE(pc.parent_id, l.category_id)` → new leaves auto-roll to their macro. No change.
- **Spend report** (`SpendReportQueryAdapter.ts:32,40`) — same macro rollup. No SQL change.
- **Price Observation Store** — schema stores no category
  (`Source/infra/src/migrations/20260611152000_initial_schema.ts`). Zero impact (also invariant #2).
- **Mobile** fetches categories at runtime from `GET /reference/categories`
  (`Source/mobile/lib/core/reference/category.dart`) — no hardcoded map, auto-picks up new leaves.

## Sync points (a taxonomy leaf must be added in ALL of these or the parity tests fail)

1. `Source/backend/src/core/domain/categoryTaxonomy.ts` — `CATEGORY_TAXONOMY`
2. `Source/infra/src/local/seeds/product-taxonomy.ts` — local dev seed (1:1 mirror)
3. New migration `Source/infra/src/migrations/<ts>_add_dining_out_and_bar_leaves.ts`
   (`INSERT … ON CONFLICT DO NOTHING`)
4. `Source/infra/test/seed_reference_data.test.ts` — asserts every taxonomy id exists in the snapshot
5. `Source/backend/src/tests/unit/core/domain/categoryTaxonomy.test.ts`
6. `Source/webapp/src/components/ds/CategoryIcon.tsx` — `CATEGORY_PARENTS` leaf→macro map
   (macro icon `cat-dining-out` / `cat-bars-pubs` already exists, so leaves reuse the parent icon)

See the [merchant seed 3-copy pinning] convention for the analogous rule on merchant seeds
(migration seed + local seed + backend normalizer + `seed_merchants.test.ts`) used by sub-spec 03.

---

## Decisions of record

- **DEC-1 — Fix at the line level, not just the invoice level.** The report and every other
  consumer read `invoice_line.category_id`. Correcting only `invoice.category_id` would leave
  the breakdown broken. Non-negotiable.
- **DEC-2 — Leaf granularity (OPEN — recommended default below).** Proposed leaves:
  - `cat-dining-out` → `cat-dining-meals` ("Meals & Dishes"), `cat-dining-drinks` ("Drinks"),
    `cat-dining-snacks` ("Snacks & Sides")
  - `cat-bars-pubs` → `cat-bar-drinks` ("Drinks"), `cat-bar-food` ("Bar Food")

  Rationale: mirrors how `cat-groceries` gets meaningful sub-leaves, keeps report drill-down
  useful, and stays small enough that the "most specific" instruction plus venue context lands
  the model reliably. **Alternative** (simpler): a single `cat-dining-meals` catch-all + `cat-dining-drinks`
  and skip snacks/bar-food, reusing `-other` for edge cases. Confirm before implementing 01.
- **DEC-3 — Do not add per-line "coerce to venue macro" heuristics in the classifier.** Keep the
  classifier model-/prior-driven; the correct lever is giving the per-line model the venue context
  (sub-spec 02), not overriding its output after the fact.
- **DEC-4 — Backfill of existing dev invoices is OPTIONAL and dev-only.** Never touch prod
  (project invariant). See sub-spec 04.
