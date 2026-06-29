# 05 — Admin Pipeline Toggle

**Non-Functional 01 · Phase 3/5 · Operator control of the agentic flag**

Parent: [../01-data-ai-pipeline.md](../01-data-ai-pipeline.md) §4 · Index: [README](./README.md)

## Overview

Admin control to flip `agentic_pipeline_enabled` at runtime, with an audit trail and canary
guidance, so operators can switch pipelines and roll back without a deploy.

## Dependencies

- [04 — Dynamic Queue Routing](./04-dynamic-queue-routing.md) (the flag this toggles)
- [00 — Access Control, Routing & Audit](../../mvp/admin-console/00-access-control-routing-audit.md)
  (admin route module + `admin_audit_log`)
- Reuses: `adminRoutes.ts`, `AdminConfigService`, `AdminAuditLogAdapter`, admin app patterns.

## Design

### 1. Endpoint

`POST /admin/features/toggle` (role `ADMIN` or `OPERATOR`; server-side role guard independent of
middleware).

- Body: `{ feature: 'agentic_pipeline_enabled', value: boolean }` — validate `feature` against
  an allowlist.
- Writes the value to `/wobblio/config/features/agentic_pipeline_enabled` via the SSM tunable
  adapter.
- Audit: `admin_audit_log` row `action='feature.toggle'`,
  `details={ feature, before, after }` (before/after JSONB, the existing pattern).

### 2. UI — `/admin/pipeline-toggles`

- **Global toggle** switch (agentic ON/OFF), reflecting current SSM value.
- **Audit history** list: who, before→after, timestamp.
- **Canary guidance alert**: caution to watch DOWN-ratio and latency KPIs for 30 minutes after
  any toggle (links to the comparison dashboard, [06](./06-kpi-pipeline-comparison.md)).
- `data-testid` on the toggle, history rows, and alert.

> Routing reads the flag from a TTL cache ([04](./04-dynamic-queue-routing.md)), so a toggle
> takes effect within the cache TTL — surface this expectation in the canary alert copy.

## Checklist

- [x] `POST /admin/features/toggle` with ADMIN guard + feature allowlist (no OPERATOR role exists — see handoff)
- [x] SSM write + `admin_audit_log` row (before/after, `action='feature.toggle'`)
- [x] `/admin/pipeline-toggles`: toggle + audit history + canary alert (`data-testid`)
- [x] Unit tests: role-denied path (admin-gate guard), audit row written; `npm run skill:hexagonal-architecture-validator` exit 0
