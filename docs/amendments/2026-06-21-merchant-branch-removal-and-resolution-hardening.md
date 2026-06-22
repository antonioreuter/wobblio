# Spec amendment — Merchant identity: drop branch level + harden resolution

**Date:** 2026-06-21
**Status:** adopted
**Amends:** §6.2 (merchant canonicalization), §6.5.3 (split-route optimizer — clarification only)
**Branch:** `fix/merchant-resolution-and-branch-removal`

## What changed

### 1. Two-level identity dropped: remove `merchant_branch`

§6.2 specifies a two-level merchant identity — **brand** (`merchant`) and **branch**
(`merchant_branch`, store #1325 / Eindhoven) — stating "prices are compared at brand level
within a region, while route optimization cares about branches," and that branch resolution
is "best-effort ... Branch-level data only feeds route optimization."

**`merchant_branch` and all `branch_id` references are removed.**

**Rationale.** The branch level is consumed by nothing in the implemented system:

- `price_observation` has **no `branch_id`** — observations are keyed
  `product × merchant × region_code × country`. The Anti-Inflation Price Engine and all
  drill-downs aggregate at brand+region.
- The split-route optimizer (§6.5.3, Epic 8/10) operates on **merchants within a region**,
  not branches: "build the price matrix product × candidate **merchants**", output is
  per-merchant sub-lists. It never reads `geo_point` or any branch row; geographic
  turn-by-turn routing was never designed.
- The resolver returns `branchId: null` on every LLM/provisional path and **no code ever
  inserts a `merchant_branch` row**, so the table has always been empty. `invoice.branch_id`
  and `merchant_alias.branch_id` are likewise always null.
- Zero webapp/admin references.

The "branches feed route optimization" sentence in §6.2 was aspirational. Carrying empty
schema + dead passthrough adds resolver complexity with no consumer (YAGNI). If
store-specific geo routing is ever scoped, branch identity can be reintroduced as a new
migration; nothing about removing it now blocks that.

§6.5.3 is unchanged in behavior — this amendment only records that the optimizer is, and
always was, merchant+region (not branch) granular.

### 2. Resolution hardening: brand-level candidates + dedup constraint

§6.2 step 1 mandates normalizing the raw string and stripping trailing store numbers / city
names into separate captured fields (`AH 1325 EINDHOVEN → key "AH"`). In practice the vision
model intermittently over-captures the header into `merchant_raw`
(`"Albert Heijn XL Eindhoven Winkelcentrum Woensel"`). The normalized blob then misses the
exact alias and trigram-fuzzy alias search, and the LLM fallback was handed **only the
(empty) fuzzy candidate list** — so it could not see that a seeded "Albert Heijn" exists,
returned `is_new=true`, and created a **duplicate PROVISIONAL/AUTO merchant** alongside the
ACTIVE seed. Duplicates split price observations across phantom merchant ids, re-infer a
`default_category_id` the seed already knew, and pollute `merchant_alias` with the raw blob.

The following behavior is adopted (no spec contradiction — this implements §6.2 intent):

- **Brand-level candidates.** When exact + fuzzy-alias both miss, the resolver gathers
  candidates by trigram similarity against `merchant.brand_name` and supplies them to the
  merchant-fallback LLM, so it can match an existing brand instead of declaring a new one.
  This is country-agnostic and avoids brittle city/store-token stripping.
- **Clean alias write-back.** On resolving to an existing merchant, the alias persisted is
  the resolved merchant's normalized **brand** form, never the raw receipt blob — so repeat
  receipts hard-hit cheaply and `merchant_alias` stops bloating per store/city.
- **Duplicate prevention.** `merchant` gains `UNIQUE(brand_name, country_code)`, preceded by
  a one-time migration consolidating existing brand-name duplicates into the canonical
  (SEED/ACTIVE-preferred) merchant. `createProvisionalMerchant` becomes
  `INSERT ... ON CONFLICT (brand_name, country_code) DO NOTHING RETURNING id` with a
  select-existing fallback, so a late/racing path reuses rather than duplicates.

The resolved merchant's `default_category_id` is read from the catalog
(`getDefaultCategory`, already wired into the classifier prior); the LLM
`default_category_id` proposal now only fires for genuinely-new merchants.

This supersedes the reactive `20260621140000_merge_duplicate_seed_merchants` migration,
which cleaned duplicates at the alias-collision level only and did not prevent recurrence.
