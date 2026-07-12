# 09/05 — Shopping list: comparability rule, ambiguity surfacing, optimizer over comparison sets

**Blocks:** nothing (last in chain). **Blocked by:** 04.

## THE COMPARABILITY RULE (governs everything below)

Two linked offers (comparison-set members) are **comparable** iff:

- **(a)** both sizes are known (receipt-stated or user-annotated via "Set size") **and equal** (same `pack_size_base_units` and `base_unit`), **or**
- **(b)** the membership carries `size_equivalent = true` (user confirmed "same size/pack" at link time).

No per-unit math ever. Pack equality or the user's explicit assertion are the only bases for ranking. Additionally, an offer must be **unambiguous** (below) to be ranked. Non-comparable or ambiguous offers are *displayed*, never *ranked*.

Worked cases (the two that motivated this family):
- **Milk:** "Milk" (size not stated) at merchant A vs "Milk 2L" at B → linked but not comparable → side-by-side prices, A shows "size not stated" + one-tap "Set size". User annotates A as 2L (or answers "same size" on the link) → comparable → crown unlocks.
- **Coca-Cola:** at merchant B, one product name covers a 12x33cl and a 2L SKU → bimodal price history → ambiguity flag → shown as a range, excluded from crown and optimizer, with a split-resolution path.

## Item resolution

- Autocomplete ranks the tenant's **own purchase history first**, then the regional catalog (`/products/search`, per-merchant identities from 09/02). Every suggestion shows merchant, last pack price (own or regional median), and the size chip (receipt-stated / user-annotated / unknown).
- The user picks a concrete `(product @ merchant)` → `shopping_list_item.product_id`. Free text left unresolved behaves exactly as today: excluded from pricing, assigned to the primary store (§6.5.3 unchanged).

## Item pricing display

For a resolved item, candidate offers = its own product's cell + its comparison-set siblings' cells. Cell price source order: regional median (`price_observation`, k≥3, ≤60d, region/currency-filtered) → tenant's own average (`invoice_line`) → none.

- **No links:** own offer only — "seen at Jumbo for €1.09 (2L)". Plus one-tap "compare with…" (creates a link, 09/04). **Never a cross-store claim without a link.**
- **Links, comparable (rule above):** best-price **crown** across comparable, unambiguous offers, with per-offer confidence reusing the optimizer tiers (`routeOptimizer.ts:290–296`: High ≥10 obs ≤30d / Medium ≥3 obs ≤90d / Low otherwise) and price source (regional vs own history).
- **Links, not comparable:** side-by-side pack prices with size chips, label *"sizes differ or not stated — no best price"*, inline "Set size" / "confirm same size" affordances that flip the pair to comparable.
- **Ambiguous offer:** rendered as a price range with the warning below; excluded from the crown even if linked and size-confirmed.

## Price-ambiguity flag (same-name collision detection)

Computed at read time over a `(product, merchant)` cell's trailing 26-week, non-quarantined observations:

- Split observations into two clusters (1-D 2-means or median split). Flag **ambiguous** when each cluster has **≥3 observations** and the cluster medians differ by more than a configured gap (SSM `/wobblio/config/pricing/ambiguity_gap_pct`, default **40%**), with discounted observations excluded from clustering (promos are not ambiguity).
- Effect: excluded from best-price ranking and from the optimizer matrix; displayed as "€0.99–€2.49 — may cover different products at this store"; same flag drives the trend-series banner (09/04).
- **Resolution path (user-driven, never automatic):** from the warning, the user can split the product — pick which of their own purchases belong to which variant (writes `USER_CONFIRMED` aliases + "Set size" on each variant). Backend: clone product at same merchant, reassign the user-identified aliases/lines; global observations re-home as future receipts resolve through the corrected aliases. Auto-split is explicitly forbidden.

## Optimizer (split-route) over comparison sets

`routeOptimizer.ts` is unchanged: greedy partition, single-best-store baseline, SSM €5 split threshold, €1.50 marginal-merge, ≤3 stores, confidence tiers, unresolved-items-to-primary-store.

Only the **matrix input** (`PriceMatrixAdapter`) changes:

- An item's row contains its own product's cell plus **only the comparable AND unambiguous** cells from its comparison sets. Watch-only links (`size_equivalent = false`, sizes not known-equal) and ambiguous cells never enter the matrix — the optimizer can never recommend switching stores on a 12-pack-vs-2L price.
- Items with no comparable cells price only at their own merchant (they behave like pinned items in the greedy pass).
- **Degradation ladder:** rich links → full split-route as today; sparse links → split-route over the linked subset, rest pinned; **zero usable links → whole-basket per-merchant totals** from the tenant's own purchase history ("your usual basket costs ~€52 at AH vs ~€49 at Jumbo — link items to unlock split suggestions"), clearly labeled as own-history-based.
- Output per line additionally carries *why* an offer was or wasn't considered (`comparable`, `watch_only`, `ambiguous`, `no_link`) so the UI can explain instead of silently omitting.

## Acceptance criteria

- [ ] Comparability rule implemented in one domain function with unit tests covering: equal known sizes (comparable), differing known sizes (not), one unknown (not), unknown+`size_equivalent` (comparable), ambiguous (never rankable).
- [ ] Milk scenario e2e: crown absent → "Set size" on the unknown offer → crown appears.
- [ ] Coca-Cola scenario: seeded bimodal observations trigger the flag; offer shows range, excluded from crown and matrix; user split flow writes `USER_CONFIRMED` aliases; auto-split impossible.
- [ ] Optimizer unit tests: watch-only and ambiguous cells never in the matrix; zero-links basket produces per-merchant totals labeled own-history.
- [ ] No cross-store price claim renders for unlinked items (UI test via `data-testid`).
- [ ] `npm run skill:hexagonal-architecture-validator` exit 0; `npm run test:unit` green.
