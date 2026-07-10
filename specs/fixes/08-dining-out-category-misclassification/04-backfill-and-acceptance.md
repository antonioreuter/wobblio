# 08.04 — Backfill existing data and end-to-end acceptance

**Goal.** Prove the whole chain works on a real McDonald's receipt, and decide what to do about
invoices already mis-categorised in the dev database. **Depends on 01, 02, 03.**

## End-to-end acceptance (the real proof)

1. **Fixture.** Add a fast-food receipt fixture under `invoices/` (a McDonald's / Burger King
   receipt with meals, a drink, fries, and a fee/deposit line if available). A synthetic one is
   fine if no real sample exists.
2. **Run the ingestion harness** (`STAGE=local`, real Bedrock dev models — see
   [reference_bedrock_dev_model_ids] / [reference_local_bedrock]) end-to-end through
   presign-confirm → worker → finalize.
3. **Assert:**
   - Every food/drink `invoice_line.category_id` resolves to a `cat-dining-*` leaf (not a grocery
     leaf).
   - `invoice.category_id === 'cat-dining-out'`.
   - The spend-breakdown report (`GET` the categories endpoint / `SpendReportQueryAdapter.categories`)
     attributes the spend to the **Dining Out** macro, with **zero** of it under Groceries.
   - The `dining-out` tag is suggested.
4. **Regression guard.** Re-run a supermarket fixture (Albert Heijn / Jumbo) and confirm its lines
   still classify into grocery leaves — the venue rule must not bleed into supermarket receipts.
   Consider adding a small A/B eval fixture set (fast-food + supermarket + mixed) to lock this in,
   in the spirit of the existing `eval:country-prompt` harness.

## Backfill (DEC-4 — OPTIONAL, dev-only, never prod)

Existing dev invoices from restaurant merchants already have grocery `category_id`s persisted on
their lines. Options, cheapest first:

- **(a) Do nothing.** Historical dev rows self-correct only on re-ingestion; acceptable for dev.
- **(b) Targeted merchant re-stamp (no LLM).** For invoices whose merchant now carries the
  `cat-dining-out` prior, a one-off dev SQL/script can move obvious grocery-leaf food lines to a
  dining leaf — but this is heuristic and lossy; prefer (c) if accuracy matters.
- **(c) Re-normalize on demand.** Re-run the normalization/classification path for the affected
  dev invoices via a local script (reuses ports; incurs Bedrock cost).

**Hard constraint:** never connect to prod / prod DB (project invariant). Any backfill runs only
against the dev database, as the object-owning migration role where DDL/DML is involved
(see [reference_dev_db_migration_access]).

Price observations are unaffected — the store holds no category (invariant #2), so nothing to
backfill there.

## Acceptance

- [ ] Fast-food fixture ingests end-to-end with all food/drink lines on `cat-dining-*` leaves and
  the report showing Dining Out, €0 under Groceries.
- [ ] Supermarket regression fixture unchanged (grocery leaves intact).
- [ ] `npm run test:unit`, `skill:hexagonal-architecture-validator`, and (if DDL/adapters changed)
  `validate:security` all green.
- [ ] Handoff `00-handoff.md` status table updated to DONE; backfill decision recorded.
