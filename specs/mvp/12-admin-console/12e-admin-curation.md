# 12e — Alias-Curation Queue

**Epic 10 | Phase 5 | Parent: [12 — Admin Console](../12-admin-console.md)**

Operator review of PROVISIONAL merchants and products: approve, merge, or reject. **Gaps:** the
catalog adapters are create-only (no status flip / merge), and there is no "how many tenants are
waiting" ranking. Both are added here, honoring invariant #8 (catalog quorum) and Appendix A
(canonical for this subsystem).

## Dependencies

- [12a — Admin Foundation](./12a-admin-foundation.md)
- [08 — Data Intelligence Layer](../08-data-intelligence-layer.md) (canonicalization, quorum)
- Appendix A of the v2.4 spec — **canonical** for catalog promotion conflicts.

## Backend

Two queues (merchant, product), each sorted by pending-tenant count descending.

- `GET /admin/curation/merchants?status=PROVISIONAL` / `GET /admin/curation/products?...`
- `POST /admin/curation/merchants/{id}/approve` — `status=ACTIVE`.
- `POST /admin/curation/merchants/{id}/merge` `{ targetId }` — merge into an existing entity,
  retarget aliases.
- `POST /admin/curation/merchants/{id}/reject` — `status=REJECTED`, aliases retargeted/cleared.
- Same four for `products`.
- Batch approve/reject of selected ids.

### Gap 1 — pending-tenant ranking

No counter exists. Add a ranking source so provisional entities sort by **distinct waiting
tenants** (how many tenants have an invoice blocked on this entity's promotion). Options to
decide at build time:

- a counter column maintained on provisional create/corroborate, or
- a query joining provisional entities to blocked invoices via `ingestion_ledger`.

Prefer the query unless it is too slow at the read path (Rule of Three before caching). New
migration only if a counter/junction is chosen.

### Gap 2 — curation service

`core/services/data-intelligence/CurationService.ts` — `approve`, `merge`, `reject` for both
entity types. Extend `MerchantCatalogAdapter` / `ProductCatalogAdapter` (currently create-only)
with status-flip + alias-retarget methods behind their ports. Approve must still respect the
read-time serving rule (a cell needs k≥3 distinct observations — invariant #8); approval flips
status but does not bypass the serving quorum.

All mutations audit-logged (before/after status, retargeted alias ids).

## Frontend (`Source/admin/`)

`(console)/curation/page.tsx` using the **existing** `admin-alias-curation-panel` component
(approve / merge / reject with loading states). Show per item: entity name + raw aliases,
contributing-tenant count, corroboration status (eligible count / quorum). Merge needs a target
picker (search existing ACTIVE entities).

## Open decisions

- Merge target selection UX (typeahead over ACTIVE entities) — MVP can be a paste-the-id field.
- Whether reject clears aliases or retargets to a "rejected/unknown" sink — follow Appendix A.

## Checklist

- [ ] Pending-tenant ranking source (query or counter; migration only if counter/junction)
- [ ] `CurationService` (approve/merge/reject, merchant + product)
- [ ] Catalog adapters extended: status flip + alias retarget (behind ports)
- [ ] 6 endpoints + batch, ADMIN-gated, audit-logged
- [ ] Approval respects k≥3 serving quorum (invariant #8); Appendix A conflict rules honored
- [ ] `curation/page.tsx` wires `admin-alias-curation-panel`; merge target picker
- [ ] Unit tests: status transitions, alias retarget, ranking order
- [ ] Hexagonal validator exit 0; `npm run validate:security` (catalog DDL/adapter change)

## Verification

- Seed provisional merchants with differing blocked-tenant counts; `GET` returns them ranked
  desc. `approve` → ACTIVE; `merge {targetId}` retargets aliases and removes the source;
  `reject` → REJECTED per Appendix A. Each writes an audit row. A newly-approved entity with
  < 3 observations still does not serve a cell.
