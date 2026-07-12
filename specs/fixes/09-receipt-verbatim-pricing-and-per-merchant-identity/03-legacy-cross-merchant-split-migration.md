# 09/03 — Legacy cross-merchant split migration

**Blocks:** 04. **Blocked by:** 02 (`product.merchant_id` must exist).

## Principle

Existing products that accreted data from multiple merchants (via the old cross-merchant embedding acceptance) are **split, not grandfathered** (DEC-4; data manipulation explicitly authorized 2026-07-12). The split is possible because merchant evidence already exists on every dependent row: `price_observation.merchant_id`, `invoice_line → invoice.merchant_id`, `product_alias.merchant_id`. Unlike past merges, this operation writes full provenance.

**Environment gate:** dev first, verified end-to-end; production rollout is a separately approved step. Nothing in this spec licenses touching prod (NON-NEGOTIABLE).

## Algorithm

1. **Identify multi-merchant products.** A product qualifies when the union of distinct merchants across its `price_observation` rows, non-NULL-merchant `product_alias` rows, and `invoice_line→invoice.merchant_id` rows has cardinality > 1. Products with exactly one merchant are simply stamped (`product.merchant_id = that merchant`) — no split.
2. **Pick the home merchant** deterministically: most `price_observation` rows; tie-break by most `invoice_line` rows, then earliest alias `id`. The original `product` row keeps its UUID and is stamped with the home merchant.
3. **Clone per extra merchant.** For each other merchant M: insert a new `product` row copying `display_name`, `brand`, `category_id`, `base_unit`, `pack_size_base_units`, `embedding`; `merchant_id = M`; `created_via = AUTO`; **`status` inherited from the parent** — corroboration already happened pre-split, and the k≥3 read-time gate keeps *serving* safe per cell regardless of status, so re-quarantining would only hide users' own history.
4. **Reassign dependents by their own merchant evidence:**
   - `price_observation` rows → the clone whose `merchant_id` matches the row's `merchant_id`.
   - `invoice_line` rows → the clone matching `invoice.merchant_id`; lines on NULL-merchant invoices stay on the home product.
   - `product_alias` rows (merchant-scoped) → matching clone; NULL-merchant aliases stay on home.
   - `shopping_list_item.product_id` (no merchant context on the row): repoint per tenant to the clone that tenant has purchased most (from their `invoice_line` history); tenants with no purchase signal keep the home product.
5. **Seed comparison-set links (UX preservation).** For each tenant whose `invoice_line` history now spans ≥2 clones of one former product, auto-create a comparison set (09/04 table) containing those clones, `source = SPLIT_SEED`, `size_equivalent = false` (watch-only until the user confirms — the system must not assert size equivalence it never had). Their cross-merchant trend view survives as an explicit, user-owned, user-editable link.
6. **Provenance.** New table `product_split_log(id, parent_product_id, new_product_id, merchant_id, observation_rows, invoice_line_rows, alias_rows, executed_at)` — auditable and mechanically reversible, fixing the no-provenance gap left by past merges. (Not tenant data; RLS-exempt reference/audit table, admin-read only.)

## Execution constraints

- Run as `wobblio_dev_app` (object owner) per the dev-migration runbook (`DATABASE_URL` with `uselibpqcompat=true&sslmode=require`); RLS-bound runtime role cannot perform this.
- One transaction per product family (parent + clones + reassignments + log rows) so a failure leaves no half-split product.
- Step 5 touches tenant-scoped tables from a migration context: comparison-set seeding must set rows' `tenant_id` explicitly from the derived tenant, and the seeding query must be reviewed against invariant #1 (no cross-tenant leakage in what gets seeded — each tenant's links derive only from that tenant's own invoice lines).
- Idempotent re-run guard: skip products already present in `product_split_log` as parents.

## Verification (dev)

- Pre/post row-count reconciliation per family: Σ observations/lines/aliases across parent+clones equals the pre-split counts; zero rows whose merchant evidence disagrees with their product's `merchant_id` (final assertion query must return 0).
- Spot-check known multi-merchant products (e.g. milk/cola staples) in the trend UI: each former single "product" now appears as one series per merchant; users with cross-merchant history see a seeded comparison set.
- `npm run validate:security` (new tables + DDL); integration test for the migration on a seeded local DB before dev.

## Acceptance criteria

- [ ] No product has dependent rows from a merchant other than its own (assertion query = 0 rows).
- [ ] Every split is logged in `product_split_log` with matching row counts.
- [ ] Seeded comparison sets exist exactly for tenants with ≥2-clone purchase history; all `SPLIT_SEED`, all watch-only.
- [ ] Re-running the migration is a no-op.
- [ ] Prod untouched; prod rollout documented as a separate gated runbook step.
