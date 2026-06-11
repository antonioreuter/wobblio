# 08 — Data Intelligence Layer

**Epic 15 | Phase 3 | Runs inside the ingestion worker; required for flagship features**

## Overview

Five sequential pipelines running inside the SQS ingestion worker after vision parse. These pipelines are what make Wobblio more than a receipt scanner: they convert raw OCR strings into structured, canonical, comparable data that powers the price engine and route optimizer.

## Dependencies

- [02 — Infrastructure, Database & RLS](./02-infrastructure-database-rls.md) (pg_trgm, pgvector extensions, global tables)
- [03 — Observability Foundation](./03-observability-foundation.md) (Bedrock call metrics)
- [07 — Core Ingestion Pipeline](./07-core-ingestion-pipeline.md) (worker context)

## Pipeline Sequence (after vision parse)

```
Deduplication → Merchant Canonicalization → Product Normalization →
Invoice Classification → Tag Generation → Write tenant tables → Emit price observations
```

---

## Stage 1: Merchant Canonicalization (§6.2)

**Goal:** map raw receipt merchant strings to canonical `merchant_id` + `branch_id`.

**Resolution algorithm:**
1. Normalize raw string: uppercase, Unicode-fold, strip legal suffixes (B.V., GmbH, Ltd), collapse whitespace, extract store number and city into separate fields
2. Hard VAT/registration ID match → authoritative, short-circuits everything
3. Exact alias hit on `(alias_normalized, country_code)` → done (>95% of traffic at steady state)
4. Fuzzy match: `pg_trgm` similarity ≥ 0.65 AND margin ≥ 0.15 over runner-up → accept, write `AUTO_FUZZY` alias
5. LLM fallback (Haiku-class auxiliary): prompt with raw merchant block + top-10 fuzzy candidates + seed brand list; output: `{decision: candidate_id|NEW_MERCHANT, brand_name, confidence}`
6. `NEW_MERCHANT` → create `PROVISIONAL` merchant row; enters admin alias-curation queue

**User corrections** on review screen → write `USER_CONFIRMED` alias (outranks automatic sources on conflicts).

**Branch resolution:** best-effort; store number + postal code map to `merchant_branch`. Unmatched branches created provisionally. Branch-level data only feeds route optimization.

**Seed data required (NL launch):** Albert Heijn, Jumbo, Lidl, Aldi, Plus, Dirk, Kruidvat, Etos, Trekpleister, HEMA, Action + their common receipt abbreviations as `SEED` aliases.

---

## Stage 2: Product Normalization & Categorization (§6.3)

**Goal:** map each line item to a canonical `product_id` with `normalized_unit_price`.

**Resolution algorithm (per line item):**
1. Merchant-scoped exact alias hit on normalized raw string → done (steady-state dominant path)
2. Batch LLM expansion (Haiku-class auxiliary): one call per receipt covering all unresolved lines — expand abbreviations, emit `{brand, product_name, variant, pack_quantity, pack_unit, category_id, is_deposit_or_fee}`; prompt includes resolved merchant brand (house-brand disambiguation) + country language hint
3. Embedding match: embed `brand | product_name | variant | pack | category_id` → pgvector cosine search (same category filter); accept ≥0.92; create `PROVISIONAL` product below 0.85; flag `LOW_CONFIDENCE` in 0.85–0.92 band
4. Alias write-back: every resolution writes/updates `product_alias` (merchant-scoped) → next hit goes through step 1

**Unit-price normalization (mandatory for comparisons):**
Parse `unit_size_raw` → `(pack_quantity, base_unit)`:
- Multipack: `6X33CL` → 6 × 0.33 = 1.98 L
- Weight-priced: use printed weight
- Piece goods: `PIECE`

`normalized_unit_price = line_total ÷ quantity ÷ pack_size_base_units`

Lines where size cannot be parsed → no price observation (invoice line kept, observation excluded — clean data beats large data).

**Taxonomy (fixed, two-level, ~14 top-level categories):**
Groceries → (Dairy & Eggs, Produce, Meat & Fish, Bakery, Pantry, Frozen, Beverages, Alcohol, Snacks & Sweets), Household, Personal Care & Pharmacy, Baby & Kids, Pet, Dining Out, Transport & Fuel, Clothing, Electronics, Health, Home & Garden, Entertainment, Services, Other.

---

## Stage 3: Invoice Classification (§6.4)

**Goal:** assign one macro category to the invoice for free-tier reporting and budget mapping.

**Algorithm (cheapest first):**
1. Merchant prior: `merchant.default_category_id` (Kruidvat receipt → Personal Care unless evidence says otherwise)
2. Line-item vote: category with the largest spend share
3. LLM tiebreak (Haiku-class auxiliary): only when (1) and (2) disagree AND no category exceeds 50% of spend

`document_kind_hint=RESTAURANT_BILL` → always forces Dining Out.

User can override on review screen → stored as per-tenant merchant→category preference (no global impact).

---

## Stage 4: AI Search Tag Generation (§6.10)

**Goal:** assign ≤3 tags per invoice from a fixed SSM-managed vocabulary.

**Two paths (merged, max 3 tags):**
1. **Deterministic prior (always runs, zero cost):** evaluate vocabulary trigger maps against resolved invoice (category spend shares + canonical merchant). Example: ≥60% Groceries → `weekly-groceries`; fuel chain merchant → `fuel`; `RESTAURANT_BILL` → `dining-out`.
2. **LLM piggyback (only when batch expansion call already runs):** `suggested_tags` field added to the product expansion prompt output (Appendix B.3); model picks 0–3 tags from vocabulary enum. Out-of-vocabulary strings silently dropped.

Tags are tenant-scoped (RLS), never emitted to Price Observation Store. User can edit tags on review screen (removes/adds from vocabulary). User edits update nothing global.

Dedicated tag call (SSM flag `tags/dedicated_call_enabled`, default **false**) — off at launch.

---

## Stage 5: Price Observation Emission (§6.5)

**Goal:** write de-identified price points to the shared `price_observation` table.

**De-identification rules:**
- No tenant ID, user ID, household ID, or invoice reference
- Region coarsened to 2-digit postal prefix (~city-sized)
- Day-granular date only

**Written per line item** (only when unit-price normalization succeeds):
```sql
INSERT INTO price_observation
  (product_id, merchant_id, country_code, region_code, observed_on,
   pack_price, normalized_unit_price, base_unit, currency, was_discounted,
   quality, quarantined, contributor_trust_at_write)
VALUES (...)
```

`quality='AUTO'` on creation; upgraded to `USER_CONFIRMED` when user corrects via review screen.

**Catalog integrity (§6.8):** provisional merchants/products → observations written with `quarantined=true`. Read-time k-threshold (≥3 distinct non-quarantined observations per cell) enforced in comparison queries.

**Price contribution opt-out:** if `app_user.price_contribution_optout = true`, skip emission for this tenant.

---

## Catalog Integrity & Anti-Poisoning (§6.8)

**Four layers:**

**Layer 1 — Provisional visibility:** auto-created merchants/products are globally hidden but fully functional for their creator. Promotion to ACTIVE requires corroboration quorum (≥3 eligible distinct tenants, or ≥2 user-confirmed, or admin approval). See Appendix A state machine.

**Layer 1a — Sybil resistance:** eligible corroborator = account ≥7 days, ≥5 parsed receipts, trust ≥20, distinct device/IP signature from other corroborators. Cross-tenant SHA-256 collision or fingerprint collision → void corroboration, flag cluster.

**Layer 2 — Statistical price plausibility:** normalized unit price tested against 90-day median for (product, region): outside [median÷4, median×4] → quarantined. No history → category-level bounds. Quantity caps: line quantity ≤200, line total ≤€10k.

**Layer 3 — Tenant trust scoring:** `trust_score` (0–100, default 20), recomputed nightly. Below 10: quarantine-only contributions. Above 60: relaxed plausibility band. Internal only, never displayed.

**Layer 4 — Velocity limits (SSM):** 10 new provisional merchants / 60 new provisional products per tenant per day. Breach: lines stay `product_id NULL`, tenant flagged in admin console. Does not block user's invoice.

---

## Checklist

### Seed Data
- [ ] NL merchant seed: load Albert Heijn, Jumbo, Lidl, Aldi, Plus, Dirk, Kruidvat, Etos, Trekpleister, HEMA, Action + receipt abbreviations as `SEED` aliases
- [ ] Product taxonomy: load two-level taxonomy (~14 top-level categories) into `product_category`
- [ ] Tag vocabulary: load ~60–80 tags with trigger maps into SSM `/wobblio/config/tags/vocabulary`
- [ ] Category-level price plausibility bounds table (e.g., Dairy: 0.20–25 €/L)
- [ ] Quantity sanity caps (max line quantity, max line total per category class)

### Merchant Canonicalization
- [ ] String normalization function (uppercase, Unicode fold, strip legal suffixes, extract store number + city)
- [ ] VAT/registration ID lookup in `merchant_alias.vat_id`
- [ ] Exact alias lookup on `(alias_normalized, country_code)` with `match_count` increment
- [ ] Fuzzy match: `pg_trgm` similarity query (accept ≥0.65 AND margin ≥0.15 over runner-up)
- [ ] LLM fallback (B.2 prompt): fires only when all previous steps fail
- [ ] `NEW_MERCHANT` flow: create `PROVISIONAL` merchant, enqueue for alias-curation queue
- [ ] `AUTO_FUZZY` alias write-back on fuzzy match
- [ ] User correction → `USER_CONFIRMED` alias write (from review screen)
- [ ] Branch resolution: best-effort store number + postal code matching
- [ ] Cross-tenant SHA-256 collision → void corroboration + flag account cluster

### Product Normalization
- [ ] Merchant-scoped exact alias lookup + `match_count` increment
- [ ] Batch LLM expansion (B.3 prompt): all unresolved lines in one call, returns `suggested_tags` too
- [ ] `is_deposit_or_fee` flagging: exclude from product matching, keep on invoice
- [ ] Embedding generation: Titan Text Embeddings V2, 512-dim, input format from B.6
- [ ] pgvector cosine search with category filter; thresholds: ≥0.92 accept, 0.85–0.92 LOW_CONFIDENCE, <0.85 create PROVISIONAL product
- [ ] `product_alias` write-back on every resolution (merchant-scoped)
- [ ] Unit-price normalization: parse `unit_size_raw` → `(pack_quantity, base_unit)`, compute `normalized_unit_price`
- [ ] Skip price observation for lines where size parsing fails
- [ ] GTIN capture field on `product` for future barcode scan mode

### Invoice Classification
- [ ] Merchant prior lookup (`merchant.default_category_id`)
- [ ] Line-item vote: category with largest spend share
- [ ] LLM tiebreak (B.4 prompt): only when prior + vote disagree AND no category >50%
- [ ] `RESTAURANT_BILL` → force Dining Out
- [ ] User override: store as per-tenant merchant→category preference, no global update

### Search Tag Generation
- [ ] Deterministic trigger map evaluation (category spend shares + canonical merchant)
- [ ] LLM piggyback: extract `suggested_tags` from B.3 prompt output (already running)
- [ ] Vocabulary validation: drop out-of-vocabulary strings silently
- [ ] Merge deterministic + LLM tags, deduplicate, cap at 3 (deterministic wins ties)
- [ ] SSM flag check for dedicated tag call (off at launch)
- [ ] Tag write to `invoice.search_tags` within ingestion transaction

### Price Observation Emission
- [ ] De-identification: strip tenant/user/household/invoice references
- [ ] Region coarsening to 2-digit postal prefix
- [ ] Day-granular date only
- [ ] `price_contribution_optout` check before emission
- [ ] Quarantine flag for PROVISIONAL merchant/product observations
- [ ] Contributor trust score captured at write time
- [ ] User correction on review screen → repair observation, upgrade to `USER_CONFIRMED`

### Catalog Integrity
- [ ] Promotion quorum check: count eligible corroborators for PROVISIONAL entity
- [ ] Eligibility criteria enforcement (account age, history, trust score, device/IP distinctness)
- [ ] Cross-tenant image hash collision detection → void corroboration + flag cluster
- [ ] Cross-tenant fingerprint collision detection (household exemption)
- [ ] Statistical plausibility filter: median ×/÷ 4 band check, category fallback bounds
- [ ] Tenant trust score nightly recomputation job (EventBridge cron)
- [ ] Velocity limit enforcement per tenant per day (10 merchants, 60 products)
- [ ] k-threshold (k≥3) enforcement in all price observation read queries

### LLM Prompt Contracts (Appendix B)
- [ ] B.1 Vision parse prompt: versioned file `/prompts/vision-parse/v1.txt`
- [ ] B.2 Merchant fallback prompt: versioned file `/prompts/merchant-fallback/v1.txt`
- [ ] B.3 Product expansion + tags prompt: versioned file `/prompts/product-expansion/v1.txt`
- [ ] B.4 Classification tiebreak prompt: versioned file `/prompts/classification-tiebreak/v1.txt`
- [ ] All prompts: temperature 0, per-request max_tokens ceiling, "JSON only" closing instruction
- [ ] Retry-once with validation errors on JSON schema failure
- [ ] `prompt_version` recorded in `invoice_feedback.model_ids_snapshot`
