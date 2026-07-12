# 09 — Receipt-verbatim pricing & per-merchant product identity (living handoff)

Price trends, inflation, and shopping-list comparisons are built on two inferences the receipts don't support: (1) a **derived per-unit price** (€/L, €/kg) computed from a pack size that most NL/EU receipt lines never print, and (2) a **cross-merchant product identity** produced by embedding similarity, which silently merges different SKUs (two Coca-Cola products with identical names and different pack sizes collide) and asserts comparability the data can't back. This family removes both: prices are used **exactly as printed on the receipt**, product identity becomes **per-merchant**, and cross-merchant comparability becomes a **user assertion** (comparison sets), never a system inference.

---

## Root cause (three coupled defects)

**Defect A — per-unit price is still derived despite the 2026-06-27 pack-price inversion.**
The inversion made `normalized_unit_price` optional but left a `unit_known` gate that *prefers* the derived figure whenever every row in a cell has one:
- `Source/backend/src/infrastructure/adapters/data-intelligence/PriceTrendQueryAdapter.ts:66–74` (market trend)
- `Source/backend/src/infrastructure/adapters/data-intelligence/OwnPurchaseHistoryQueryAdapter.ts:79–94` (own history)
- `Source/backend/src/infrastructure/adapters/data-intelligence/PersonalInflationQueryAdapter.ts:51–62` (+ region inflation variants)

Derivation happens at ingestion: `ProductNormalizer.ts:155` → `unitSize.ts:61–71` (`lineTotal ÷ quantity ÷ packQuantity`), written by `InvoiceRepositoryAdapter.ts:203,208`. The product-expansion prompt (`productExpansion.ts:16–17`) even instructs the model to *compute* pack size ("1.98 for 6x33cl"). The webapp renders €/L / €/kg labels (`Source/webapp/src/app/(app)/reports/page.tsx:58–63`).

**Defect B — cross-merchant identity by embedding similarity is unreliable.**
§6.3 step 3 accepts a cosine match ≥0.92 across merchants (within category). When pack info is absent (~96% of lines), the embedding inputs for physically different SKUs are identical, so they converge on one `product_id`. The resulting "cross-merchant comparison" mixes different products.

**Defect C — shopping-list "best price" ranks incomparable offers.**
With sizes mostly unknown and identities merged, a best-price answer for "milk" compares a 2L jug against an unknown-size product, or two different Coca-Cola SKUs that share a name at one merchant. Nothing surfaces the ambiguity.

---

## The fix, in one paragraph

Drop per-unit derivation end-to-end (columns, computation, `unit_known` gates, €/L UI); every price served is the pack price actually paid, with size shown as a descriptive chip only when the receipt stated it or the user set it. Make product identity per-merchant (`product.merchant_id`; embedding candidates scoped to one merchant) and split existing multi-merchant products with an audited, provenance-logged data migration. Replace system-asserted comparability with tenant-scoped **comparison sets**: the user links products across merchants, the trend picker plots up to 3 user-chosen `(product, merchant)` series, and the shopping list / split-route optimizer rank only offers that pass an explicit **comparability rule** (equal known pack sizes, or the user confirmed "same size/pack") and are not price-ambiguous (bimodal same-name collisions are flagged, never ranked).

---

## Sub-specs

| # | File | Blocks | Status |
|---|------|--------|--------|
| 01 | `01-receipt-verbatim-pricing.md` | — | PENDING |
| 02 | `02-per-merchant-product-identity.md` | — | PENDING |
| 03 | `03-legacy-cross-merchant-split-migration.md` | 02 | PENDING |
| 04 | `04-comparison-sets-and-trend-picker.md` | 02, 03 | PENDING |
| 05 | `05-shopping-list-ambiguity-and-optimizer.md` | 04 | PENDING |

Amendment record: `docs/amendments/2026-07-12-receipt-verbatim-pricing-and-per-merchant-identity.md` (amends §6.3 steps 3–4, §6.3.4, §6.5.1–6.5.3, Appendix B.3/B.6).

## DAG

```
01 (verbatim pricing) ──────────────────────────┐
                                                 ├─ independent tracks; 01 can ship first
02 (per-merchant identity) ─→ 03 (legacy split) ─→ 04 (comparison sets + trend picker) ─→ 05 (shopping list + optimizer)
```

## Where this stands

Spec-complete 2026-07-12; nothing implemented. All statuses PENDING.

---

## Blast radius (what does NOT change)

- **Price Observation Store key & de-identification (invariant #2):** `(product_id, merchant_id, region_code, observed_on)` unchanged; still no tenant reference; RLS exemption untouched.
- **k≥3 read-time serving gate, 60-day staleness, 26-week window, weekly medians, discount separation (§6.5.1):** all unchanged — only *which value* is medianed changes (always pack price).
- **Catalog promotion / Sybil gating (§6.8, Appendix A):** unchanged; corroborators of a `(product, merchant)` are exactly that merchant's shoppers, so quorum math is unaffected.
- **Within-merchant canonicalization (§6.3 steps 1–2, 4):** merchant-scoped `product_alias` absorption stays — it is what makes LLM cost decay and what makes a per-merchant series coherent.
- **Spend reports, budgets, bill-splitting, FX:** no per-unit usage (verified `SpendReportQueryAdapter.ts`), unaffected.
- **Mobile inflation pulse:** index-based (percent, not per-unit) — only backend adapter internals change.
- **`routeOptimizer.ts` algorithm:** greedy partition, €5 split / €1.50 marginal thresholds, ≤3 stores, confidence tiers all unchanged; only the price-matrix *input* changes.
- **`product_concept`:** remains deferred/dead; this family supersedes the concept-level "cheapest place to buy milk" idea with user comparison sets.

## Sync points (change all or parity/validators fail)

1. `price_observation` DDL migration ⇄ `PriceObservation` domain type ⇄ all four trend/inflation adapter queries.
2. `invoice_line` DDL migration ⇄ `InvoiceRepositoryAdapter` insert ⇄ GDPR export CSV contract (`ExportDataSourceAdapter.ts:50`).
3. Product-expansion prompt version bump (v4→v5) ⇄ `productExpansionSchema.ts` ⇄ prompt-injection-scanner expectations.
4. `product.merchant_id` migration ⇄ embedding candidate query ⇄ catalog merge guard ⇄ admin console product views.
5. New RLS tables (`product_comparison_set*`, `product_split_log`) ⇄ `npm run validate:security` RLS coverage.

---

## Decisions of record

- **DEC-1 — Receipt-verbatim pricing.** No per-unit price is ever computed, stored, or shown. The only prices in the system are amounts printed on receipts (pack price = `line_total ÷ quantity` is receipt arithmetic, not inference). Size is descriptive/identity metadata with three evidence states: receipt-stated, user-annotated, unknown. *Rejected alternatives:* display-only €/L when the receipt states size (still normalizes; user rejected), same-SKU-only normalization (keeps dead code paths for ~4% of data).
- **DEC-2 — Per-merchant product identity.** A product belongs to exactly one merchant. Cross-merchant embedding acceptance is removed; within-merchant normalization is preserved. This is also methodologically better for the inflation story (CPI tracks a fixed item at a fixed outlet).
- **DEC-3 — User-asserted comparability.** Cross-merchant comparison exists only where the user created it (comparison sets, trend picker choices). Ranking additionally requires the comparability rule (equal known sizes or explicit "same size/pack") and no price-ambiguity flag. The system never silently declares two offers comparable.
- **DEC-4 — Split, don't grandfather.** Existing multi-merchant products are split per merchant by a data migration, reassigning observations/lines/aliases by their own merchant evidence, seeding comparison-set links to preserve each user's existing cross-merchant views, and writing `product_split_log` provenance (fixing the no-provenance gap left by past merges). User explicitly authorized the data manipulation (2026-07-12). Dev first; prod is a separately gated step and is never touched from this work directly (NON-NEGOTIABLE).
