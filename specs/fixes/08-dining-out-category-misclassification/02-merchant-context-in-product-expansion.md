# 08.02 — Thread venue context into per-line product expansion

**Goal.** Make the per-line product-expansion LLM aware of the merchant/venue so it routes
served food and drink into the new dining-out / bars-pubs leaves instead of grocery leaves.
Without this, sub-spec 01's leaves exist but the model still can't tell a restaurant burger
from a supermarket ready-meal. **Depends on 01.**

## The gap being closed

`ProductNormalizer.normalize(merchantId, lines, countryCode)` already has the merchant id
(`ProductNormalizer.ts:44`) but `buildExpansionMessage` builds `<categories>/<tags>/<lines>`
only — no merchant/venue signal reaches the model (`ProductNormalizer.ts:54,176-181`). The
prompt comment claims otherwise (`prompts/productExpansion.ts:3`); the code never delivered it.

## Changes

1. **Resolve a venue hint in the service.** In `ProductNormalizer.normalize`, look up the
   merchant's `brand_name` and `default_category_id` via the existing product-catalog / merchant
   port (the classifier already reads `default_category_id` through
   `MerchantCatalogAdapter.getDefaultCategory` — reuse that capability; extend the port lean-ly
   per ISP if a combined brand+category read is cleaner). Pass both down into `expandBatched` →
   `expand` → `buildExpansionMessage`.
   - `merchantId === null` (unknown merchant) → pass `brand=null`, `macroPrior=null`; prompt
     falls back to line-text-only behaviour (current behaviour preserved).

2. **Extend the expansion message** — `buildExpansionMessage(brand, macroPrior, rawTexts)`:
   add a `<merchant>` block, e.g.
   `<merchant brand="McDonald's" typical_category="cat-dining-out"/>` (omit attributes that are
   null). Keep XML-tag separation (invariant #12 / ai-prompt rule).

3. **Prompt v4** — `Source/backend/src/prompts/productExpansion.ts`
   - Bump `PRODUCT_EXPANSION_PROMPT_VERSION` to `product-expansion/v4`.
   - Add a rule: *when `<merchant>` indicates a restaurant, café, fast-food, takeaway, canteen
     or bar/pub venue (by brand or `typical_category` = `cat-dining-out` / `cat-bars-pubs`),
     classify food and drink lines into the venue leaves* (`cat-dining-meals` /
     `cat-dining-drinks` / `cat-dining-snacks`, or `cat-bar-drinks` / `cat-bar-food`) *rather than
     grocery leaves — a burger, fries or cola bought at a restaurant is dining-out, not groceries.*
   - Keep the "most specific id" instruction, but make the venue rule take precedence for
     venue-served items. Update the prompt's own header comment to match reality.

4. **Schema/validator** — `Source/backend/src/core/domain/productExpansionSchema.ts` needs no
   structural change (still `category_id` validated against `isValidCategoryId`, which now includes
   the new leaves via 01). Confirm the retry-with-errors path still holds (invariant #12).

## Design notes / trade-offs

- **Why context beats a post-hoc override (DEC-3).** Passing the venue to the model keeps a single
  source of truth (the model, given the right inputs) and correctly handles mixed receipts (e.g. a
  supermarket that also has a hot-food counter) without brittle rules. The classifier's line-vote
  then naturally tips dining-out because the lines now carry dining leaves.
- **Cost.** No extra Bedrock calls — the merchant hint rides the existing batch expansion request.
  Qwen cannot use Bedrock prompt caching, so keep the added tokens minimal (one `<merchant>` line).
- **Prompt-injection.** `brand` originates from our normalized merchant record, not raw OCR, so it
  is low-risk; still emit it inside an XML attribute, never interpolated into an instruction.

## Acceptance

- [ ] `cd Source/backend && npm run test:unit` — new/updated `ProductNormalizer` unit tests
  (mocked ports) assert: (a) when merchant prior is `cat-dining-out`, the `<merchant>` block is
  present in the expansion message; (b) unknown merchant → no `<merchant>` block, legacy message
  shape unchanged.
- [ ] `npm run skill:hexagonal-architecture-validator` exit 0 (no SDK/infra import leaks into core;
  any port extension stays in `src/core/ports/`).
- [ ] `prompt-injection-scanner` / `ai-prompt-extraction-engineer` checks still pass (XML separators,
  schema-conformant output, one retry before DLQ).
- [ ] Manual/eval check via the ingestion harness (`STAGE=local`, real Bedrock dev model): a
  McDonald's fixture normalizes its food/drink lines to `cat-dining-*` leaves (see sub-spec 04).
