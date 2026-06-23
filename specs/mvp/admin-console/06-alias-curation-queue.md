# 06 — Alias-Curation Queue

**Epic 10 | Phase 5 | Operator promotion of provisional catalog entities**

## Overview

Two review queues — **provisional merchants** and **provisional products** — sorted by how many tenants
are waiting on each (pending-corroboration count, descending). Operators can approve, merge, or reject
entries. Catalog promotion follows §6.8 / Appendix A (canonical for this subsystem).

**Folded-in prerequisite:** the schema does not currently track "how many tenants are waiting on this
entity" or the eligible-corroborator count, which the sort and the corroboration-status column require.
This sub-spec owns that tracking.

**Schema drift to resolve:** the live enums are `merchant_status` and `catalog_status` =
`('PROVISIONAL','ACTIVE','INACTIVE')` — there is **no `REJECTED`**. The parent spec's "Reject →
REJECTED" must map to `INACTIVE`, or add a `REJECTED` enum value. Decide and record in the migration.

Parent: [12 — Admin Console](../12-admin-console.md).

## Dependencies

- [00 — Access Control, Routing & Audit](./00-access-control-routing-audit.md) (admin route module + audit log)
- [08 — Data Intelligence Layer](../08-data-intelligence-layer.md) (canonicalization, quorum, §6.8 promotion rules)
- [02 — Infrastructure, Database & RLS](../02-infrastructure-database-rls.md) (`merchant`, `merchant_alias`, `product`, `product_alias`)

## Pending-tenant / corroboration tracking (folded-in prerequisite)

Provide, per provisional entity, the distinct count of tenants contributing observations that resolved
to it, plus the eligible-corroborator count against the quorum (§6.8). Implement as a query/rollup over
existing observation→entity linkage (avoid a denormalized counter unless a query proves too slow —
Rule of Three). Expose via the repository port consumed by the endpoints below.

## Endpoints

- `GET /admin/curation/merchants?status=PROVISIONAL` — provisional merchants, sorted by pending-tenant
  count desc. Each item: entity name, raw aliases that resolved to it, contributing-tenant count,
  corroboration status (eligible count / quorum).
- `GET /admin/curation/products?status=PROVISIONAL` — same for products.
- `POST /admin/curation/merchants/{id}/approve` — set `status=ACTIVE`. Audited.
- `POST /admin/curation/merchants/{id}/merge` with `{ targetId }` — merge into an existing entity,
  retarget aliases. Audited.
- `POST /admin/curation/merchants/{id}/reject` — set rejected status (per drift decision). Aliases
  retargeted or cleared. Audited.
- Same four endpoints for products.
- Batch approve/reject of selected items.

Promotion must respect §6.8 / Appendix A (Sybil-gated quorum, k≥3 distinct observations at read time for
a serving cell). Admin approval is the explicit-override path.

## UI

Two tabbed queues, sorted by pending-tenant count. Per item: name, aliases, tenant count, corroboration
status, and Approve / Merge / Reject actions. Batch selection. Confirmation on merge/reject.

## Checklist

- [ ] Resolve status-enum drift: map "reject" to `INACTIVE` or add `REJECTED` (migration + decision note)
- [ ] Pending-tenant / corroboration-count surfaced per provisional entity (query or rollup)
- [ ] `GET /admin/curation/merchants` + `/products` — provisional, sorted by pending-tenant desc
- [ ] approve / merge / reject endpoints for merchants and products — all audited
- [ ] Batch approve/reject
- [ ] Promotion respects §6.8 / Appendix A (quorum, k≥3 at read time)
- [ ] `data-testid` on queue rows + action buttons
- [ ] `npm run validate:security` green (DDL/adapter changes)
- [ ] `npm run skill:hexagonal-architecture-validator` exit 0; domain unit tests with mocked ports
