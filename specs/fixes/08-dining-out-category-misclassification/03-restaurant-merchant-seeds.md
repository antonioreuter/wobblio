# 08.03 — Seed fast-food / restaurant chains with a dining-out prior

**Goal.** Anchor the invoice-level classifier and the per-line venue context for the common
chains, so a McDonald's receipt is recognised as dining-out even before the model reasons over
line text. **Depends on 01** (references `cat-dining-out`). Independent of 02.

## Why

`InvoiceClassifier` treats a merchant's `default_category_id` as authoritative
(`InvoiceClassifier.ts:26-27`). Today no fast-food/restaurant merchant is seeded
(`Source/infra/src/migrations/20260620120000_seed_merchants.ts` — NL supermarkets/DIY only;
`20260709120000_seed_br_merchants.ts` — BR), so unknown chains fall through to the line vote,
which (pre-01) went to groceries. Seeding the priors makes the invoice classification and the
per-line `<merchant>` hint (sub-spec 02) agree, and gives the `MerchantFallback` prompt a
concrete `cat-dining-out` example to generalise from.

## Scope of seeds

Launch-market first (NL / Eindhoven), plus globally ubiquitous chains, each with
`default_category_id = 'cat-dining-out'`:
McDonald's, Burger King, KFC, Subway, Domino's, New York Pizza, FEBO, Starbucks, La Place,
Kentucky-style/local as needed. Keep the list small and defensible; add regional chains later.
(Bars/pubs with `cat-bars-pubs` can follow the same pattern if we have named chains; otherwise
leave bar priors to the `MerchantFallback` model.)

## The 3-copy pinning rule (see [merchant seed 3-copy pinning])

A merchant seed is pinned across three places by `seed_merchants.test.ts`; **edit all three and
extend the test**:

1. **Migration seed** — a new migration
   `Source/infra/src/migrations/<next-ts>_seed_dining_merchants.ts` (mirror the structure of
   `20260709120000_seed_br_merchants.ts`), inserting each chain with `brand_name`,
   `default_category_id = 'cat-dining-out'`, country scoping, `ON CONFLICT DO NOTHING`.
2. **Local seed** — the corresponding local merchant seed used by dev bootstrap.
3. **Backend normalizer** — the merchant alias/brand list the normalizer pins (whatever
   `seed_merchants.test.ts` currently asserts across the snapshot + local + backend).
4. **Test** — extend `Source/infra/.../seed_merchants.test.ts` (or the backend equivalent the
   memory references) so the new chains are asserted present in every copy with the dining-out
   prior.

## Out of scope

- Do not add per-brand venue *tags* here; brand-identity tag rules already guard against pure
  merchant-brand triggers (see [brand-identity tag guard]). The `dining-out` / `takeaway` tags
  already trigger off `category_id = cat-dining-out` (`tagVocabulary.ts`), so they light up
  automatically once the invoice classifies as dining-out.

## Acceptance

- [ ] `cd Source/infra && npm test` — `seed_merchants.test.ts` passes with the new chains pinned
  across all copies.
- [ ] Migration applies idempotently against local dev DB.
- [ ] `InvoiceClassifier` unit test: a receipt whose merchant carries
  `default_category_id = cat-dining-out` classifies the invoice as `cat-dining-out` regardless of
  line vote (extends existing merchant-prior test at `InvoiceClassifier.test.ts`).
- [ ] `dining-out` (and `takeaway` where spend-share ≥ 0.5) tags auto-suggest on a seeded-chain
  receipt.
