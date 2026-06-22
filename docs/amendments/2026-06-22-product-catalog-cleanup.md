# Spec amendment — Product catalog cleanup: promo-free identity, populated brand, drop concept

**Date:** 2026-06-22
**Status:** adopted
**Amends:** §6.3 (product normalization), §12.1 R-5 (product_concept decision)
**Branch:** `fix/merchant-resolution-and-branch-removal`

## What changed

### 1. `display_name` is promo-free product identity

§6.3 defines a canonical product as "brand + product + variant + pack size" and the
product-expansion stage builds `display_name` from the receipt line. The prompt only asked
for "a concise canonical product name", so promotion/discount/multibuy text survived into
identity — e.g. a line `"Discount 1+1 Lucovitaal"` produced `display_name = "Discount 1+1
Lucovitaal"`. Because `ProductNormalizer` embeds `display_name`, the promo text polluted the
vector, the line failed to match the clean product, and a new PROVISIONAL product was
spawned per promo variant — fragmenting the catalog.

The expansion prompt now requires `display_name` to be the product identity only, excluding
promotion text (`Discount`, `Korting`, `Bonus`, `Actie`, `Aanbieding`, `1+1`, `2e halve
prijs`, `2=1`, percent/multi-buy markers). The discount is already represented separately
(`IngestionService` sets `isDiscount = lineTotal < 0` and remaps the line to a discount
category), so promo text never belonged in product identity. Prompt version bumped
`product-expansion/v2 → v3`.

### 2. `product.brand` is now populated

`product.brand` existed in the schema (§6.3) but the LLM expansion never returned it and the
write path omitted it, so it was always NULL despite being read by product search. The
expansion output now carries an isolated `brand` (e.g. `"Lucovitaal"`, or null when
unbranded/unknown) and it is persisted on product creation. `display_name` continues to read
"brand + product + size" for display and embedding; `brand` is the separable field for
search/filtering. No schema migration is required (the column already exists).

### 3. `product_concept` + `product.concept_id` removed

§12.1 R-5 decided "`product_concept`: schema ships, UI does not (phase 2)." The table and the
`product.concept_id` FK have never been written or read — zero rows, zero code references.
Carrying dead scaffolding with an unused FK is removed now (YAGNI). When the phase-2
concept-level feature ("cheapest place to buy milk", §6.3 / §6.5.3) is built, the concept
table and FK are reintroduced as a forward migration. This reverses R-5 for these two
objects only; the two-level identity model remains the documented phase-2 target.

### 4. `product_alias.match_count` + `last_seen_at` dropped

`writeAlias` inserts with `WHERE NOT EXISTS` and no `ON CONFLICT`, so `match_count` was
always `1` and `last_seen_at` was write-once; nothing reads either. Both columns are dropped.
(`product_alias.merchant_id` and `source` remain — they are used.) If alias confidence /
§6.8 quorum needs counters later, they return with the feature that consumes them.

Existing PROVISIONAL products with polluted names / fragmented embeddings are left in place
(fix-forward only); they age out or are superseded as clean ingestions accumulate.
