# 09/01 — Receipt-verbatim pricing (remove per-unit derivation end-to-end)

**Blocks:** nothing (independent; can ship first). **Blocked by:** nothing.

## Principle

The only prices in the system are amounts that appear on receipts. `pack_price = line_total ÷ quantity` is receipt arithmetic (both operands printed) and stays the sole price signal. `normalized_unit_price = line_total ÷ quantity ÷ pack_size` is an inference over a pack size the receipt usually doesn't print — it is removed everywhere: not computed, not stored, not served, not displayed.

Size remains **descriptive/identity metadata** with three evidence states:
1. **receipt-stated** — a size token printed on the line (`"500 G"`, `"2L"`), transcribed verbatim;
2. **user-annotated** — set via the review-screen "Set size" affordance (`USER_CONFIRMED`);
3. **unknown** — absent; never inferred.

## Changes

### Schema (migration, `Source/infra/src/migrations/`)

- `invoice_line`: **drop** `normalized_unit_price`. Keep `pack_quantity` + `base_unit` (descriptive receipt facts, evidence-tagged per above). Keep `unit_price` (printed per-piece price when the receipt shows one — receipt-verbatim).
- `price_observation`: **drop** `normalized_unit_price` and `base_unit`. `pack_price` remains NOT NULL and is the only price column. (Key, de-identification, `quarantined`, `quality`, trust column all unchanged — invariant #2 untouched.)
- Down-migrations restore columns as NULL-able (data is not reconstructible; documented lossy).

### Backend

- `Source/backend/src/core/domain/unitSize.ts`: delete `computeNormalizedUnitPrice` (:61–71). `parseUnitSize` **stays** — it parses printed size tokens for the descriptive/identity fields.
- `Source/backend/src/core/services/data-intelligence/ProductNormalizer.ts:155`: stop computing `normalizedUnitPrice`; pack size flows through only as descriptive metadata (with evidence state).
- `Source/backend/src/infrastructure/adapters/ingestion/InvoiceRepositoryAdapter.ts:203,208`: stop writing the dropped columns.
- Remove the `unit_known` gate and the `CASE WHEN unit_known THEN normalized_unit_price ELSE pack_price END` selection from **all four** query adapters; medians are always over `pack_price` (observations) / `line_total ÷ quantity` (own history):
  - `PriceTrendQueryAdapter.ts:66–74`
  - `OwnPurchaseHistoryQueryAdapter.ts:79–94, 103`
  - `PersonalInflationQueryAdapter.ts:51–62`
  - `RegionInflationQueryAdapter` / `RegionInflationSeriesQueryAdapter` (same pattern)
- API contract: trend responses drop the `unit: TrendUnit | null` comparability field and instead carry per-series **size metadata** `{ sizeText: string | null, sizeSource: 'RECEIPT' | 'USER' | null }`.
- GDPR export `ExportDataSourceAdapter.ts:50`: drop `normalized_unit_price` from the invoice-lines CSV contract.

### Prompt (Appendix B.3 — `product-expansion` v4 → v5)

- Pack size must be **transcribed, never computed**: emit `pack_size_base_units`/`base_unit` only when a size token is printed on the line; otherwise `null`. Remove the arithmetic example (`"1.98 for 6x33cl"` at `productExpansion.ts:16–17`) and add an explicit prohibition: *"Do not calculate, infer, or estimate pack size. If no size is printed on the line, output null."* Multipack tokens printed on the line (e.g. `6x33cl`) are transcribed as raw text; any arithmetic on them happens deterministically in `parseUnitSize`, not in the model.
- Schema validator (`productExpansionSchema.ts`) unchanged in shape; XML separators and retry-with-errors flow per invariant #12 unchanged.

### Webapp (`Source/webapp/src/app/(app)/reports/page.tsx`, `components/workspace/trend-table.tsx`)

- Remove `unitLabel()` (€/L, €/kg, €/pc formatting; `reports/page.tsx:58–63`). All series are labeled **"price paid per item"** in the view currency.
- Show size as a descriptive chip next to the product name when known: `"2L"` (receipt) / `"2L · set by you"` (user) / `"size not stated"` (unknown).
- Drop the "confirm a size to unlock per-unit comparison" caveat card (:380–391). Replace with an honesty note only when a *comparison* mixes differing/unknown sizes (wording owned by 09/04–05).
- **"Set size" is retained but repurposed:** it writes identity/annotation metadata (feeds SKU disambiguation in 09/05) and never any price math.

## Acceptance criteria

- [ ] `grep -r normalized_unit_price Source/` returns only migration history.
- [ ] All trend/inflation medians are pack-price based; a cell that previously served €/L now serves the same weeks with pack-price medians (verify via fixture receipts in `invoices/`).
- [ ] Product-expansion prompt v5: given a line with no printed size, the model output has `pack_size_base_units: null` (eval via existing extraction fixtures); no arithmetic example remains in the template.
- [ ] Webapp trend page renders no €/unit label anywhere; size chips show the three evidence states.
- [ ] GDPR export CSV no longer contains the column; export tests updated.
- [ ] `npm run skill:hexagonal-architecture-validator` exit 0; `npm run test:unit` green; `npm run validate:security` run (DDL changed).
