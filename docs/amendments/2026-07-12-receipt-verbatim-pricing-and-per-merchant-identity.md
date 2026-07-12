# Spec amendment — Receipt-verbatim pricing, per-merchant product identity, user-driven comparability

**Date:** 2026-07-12
**Status:** adopted
**Amends:** §6.3 (product normalization, steps 3–4), §6.3.4 (unit-price normalization — repealed), §6.5.1 (comparison query), §6.5.2 (cheapest-store resolution), §6.5.3 (split-route optimizer), Appendix B.3 (product-expansion prompt), Appendix B.6 (embedding input)
**Spec family:** `specs/fixes/09-receipt-verbatim-pricing-and-per-merchant-identity/`

## What changed

### 1. §6.3.4 repealed — no derived per-unit price anywhere

`normalized_unit_price = line_total ÷ quantity ÷ pack_size_base_units` is removed from the system: not computed at ingestion, not stored (`invoice_line.normalized_unit_price` and `price_observation.normalized_unit_price` + `base_unit` dropped), not served, not displayed. `pack_price = line_total ÷ quantity` (pure receipt arithmetic) is the sole price signal; all medians in §6.5.1/§6.5.2 are pack-price medians. Pack size survives only as descriptive/identity metadata with three evidence states — receipt-stated, user-annotated ("Set size"), unknown — and is never inferred. This completes the 2026-06-27 pack-price inversion, which had left a `unit_known` preference for the derived figure in the trend and inflation queries.

### 2. §6.3 step 3 — product identity is per-merchant

`product.merchant_id` added; embedding candidate search is restricted to the same merchant (and category). The ≥0.92 cross-merchant acceptance is removed. Steps 1–2 and 4 (merchant-scoped aliases, LLM expansion, alias write-back) are unchanged — within-merchant canonicalization is preserved. Catalog merges additionally require same merchant. Promotion/Sybil gating (§6.8, Appendix A) and the k≥3 read-time serving gate are unaffected. Existing multi-merchant products are split per merchant by an audited migration with `product_split_log` provenance (family sub-spec 03).

### 3. §6.5.1 — comparison is user-selected per-merchant series

The trend chart plots up to 3 user-chosen `(product, merchant)` series (which, under per-merchant identity, are simply product ids). Cross-merchant comparability is asserted by the user via tenant-scoped, RLS-protected **comparison sets** (`product_comparison_set`), optionally with a "same size/pack" confirmation. The system never asserts cross-merchant equivalence. Weekly pack-price medians, k≥3 quorum, 60-day staleness, 26-week window, discount separation, and single-currency views are unchanged.

### 4. §6.5.2/§6.5.3 — cheapest-store & optimizer run over comparison sets under a comparability rule

An offer may be ranked ("best price", optimizer matrix) only if it is in the item's comparison set, passes the **comparability rule** — equal known pack sizes, or user-confirmed `size_equivalent` — and is not **price-ambiguous** (bimodal same-name price history at one merchant → flagged, shown as a range, excluded from ranking, user-driven split resolution only). The greedy split-route algorithm, thresholds, and confidence tiers are unchanged; only the matrix input changes. With no usable links the feature degrades to whole-basket per-merchant totals from the user's own history. The deferred `product_concept` layer ("cheapest place to buy milk") is superseded by comparison sets.

### 5. Appendix B.3 — pack size is transcribed, never computed (prompt v4 → v5)

The product-expansion prompt must emit pack size only when a size token is printed on the receipt line, and null otherwise; calculating or inferring size is explicitly prohibited and the arithmetic example ("1.98 for 6x33cl") is removed. Deterministic parsing of printed multipack tokens remains in code. Appendix B.6 embedding input format is unchanged in principle (pack text remains an identity token when present).

## Rationale

Receipts rarely print pack size (~96% of NL lines lack one), so derived per-unit prices and embedding-based cross-merchant identity both asserted comparability the data cannot support — silently merging distinct SKUs (identically named 12x33cl and 2L colas) and comparing unknown sizes. Per-merchant series are also methodologically stronger for the anti-inflation story (CPI tracks a fixed item at a fixed outlet). Comparability becomes the user's explicit, tenant-scoped assertion; the app's job is honest evidence, not invented normalization.
