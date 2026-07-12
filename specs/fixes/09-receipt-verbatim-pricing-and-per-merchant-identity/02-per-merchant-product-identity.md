# 09/02 — Per-merchant product identity (new resolutions)

**Blocks:** 03, 04. **Blocked by:** nothing.

## Principle

A product belongs to exactly one merchant. "AH halfvolle melk" and "Jumbo halfvolle melk" are two products, even if physically identical — whether they are comparable is the *user's* call (09/04), not an embedding threshold's. Within-merchant canonicalization (OCR variants, truncations like `COCA-C ZERO`) is explicitly preserved: it is what makes the LLM cost decay (§6.3 step 4) and what makes a per-merchant price series coherent.

## Changes

### Schema (migration)

- `product`: add `merchant_id UUID NULL REFERENCES merchant(id)`.
  - NULL is allowed only for (a) pre-split legacy rows during the 09/03 transition and (b) merchant-agnostic seed products, if any survive review; **every new AUTO/ADMIN product is stamped** with the resolving receipt's merchant.
  - Index `(merchant_id, category_id)` to serve the scoped embedding search.
  - Advisory (non-unique) index on `(merchant_id, display_name, brand)` for duplicate detection in admin tooling.

### Resolution pipeline (§6.3 amended)

- **Step 1 (merchant-scoped exact alias):** unchanged.
- **Step 2 (batch LLM expansion):** unchanged (prompt changes live in 09/01).
- **Step 3 (embedding match):** candidate set restricted to products of the **same `merchant_id`** (and same category, as today). The ≥0.92 cross-merchant acceptance is removed; thresholds within a merchant stay as-is (accept ≥0.92, PROVISIONAL 0.85–0.92, new product <0.85). Net effect: smaller candidate sets, cheaper and stricter matching.
- **Step 4 (alias write-back):** unchanged; every alias now necessarily points at a product of its own merchant (add a consistency check: `product_alias.merchant_id` must equal the product's `merchant_id` when both are non-NULL).
- **Step 5 (user corrections):** the review screen's product-reassignment picker offers only same-merchant products.

### Guards

- **Catalog merge guard:** admin merges additionally require identical `merchant_id` (on top of the existing same-category+unit & similarity ≥0.85 rules). Cross-merchant merge attempts are rejected with an explicit error.
- **Promotion/Sybil (§6.8, Appendix A): unchanged.** Corroborators of a `(product, merchant)` are exactly that merchant's shoppers; quorum (≥3 corroborators / 2 user-confirms / admin) and the k≥3 read-time serving gate are untouched.
- **Product search (`/products/search`):** results always display the merchant; dedupe-by-name across merchants is *not* performed (same name at two merchants = two rows, by design).

## Out of scope here

- Existing multi-merchant products → 09/03 (split migration).
- Any cross-merchant linking → 09/04 (comparison sets).

## Acceptance criteria

- [ ] New products created by ingestion always carry `merchant_id`; unit test: same receipt line text at two different merchants yields two distinct products.
- [ ] Embedding candidate query filters by `merchant_id`; unit test proves a ≥0.92 cosine match at another merchant is NOT accepted.
- [ ] Merge guard rejects cross-merchant merges (unit test).
- [ ] Alias↔product merchant consistency check enforced (constraint or validated write path).
- [ ] `npm run skill:hexagonal-architecture-validator` exit 0; `npm run test:unit` green; `npm run validate:security` run (DDL changed).
