# 02 — SSM Parameter Editor

**Epic 10 | Phase 5 | Live editing of tunable runtime parameters**

## Overview

A table UI to read and edit the tunable SSM parameters that govern runtime behaviour. Changes take
effect on the next Lambda warm start or SSM cache expiry. High-impact edits require a confirmation
modal and are audited.

Parent: [12 — Admin Console](../12-admin-console.md).

## Dependencies

- [00 — Access Control, Routing & Audit](./00-access-control-routing-audit.md) (admin route module + audit log)

## Parameters exposed

- `max_free_users_cap` — waitlist trigger
- `routing/min_split_saving` — route optimizer saving threshold (€)
- `routing/max_stores` — max stores in split route
- `tags/vocabulary` — JSON tag vocabulary with trigger maps
- `tags/dedicated_call_enabled` — boolean toggle
- Per-model token ceilings (vision_parser, auxiliary, insight, embedder)

Model **IDs** are edited in [03 — Model-Swap Matrix](./03-model-swap-matrix.md), not here. This editor
covers the tunables above (the model section covers `/wobblio/config/models/*` identifiers).

## Endpoints

- `GET /admin/config` — list the exposed parameters with current values (read via the SSM adapter).
- `PUT /admin/config/{param}` — update one parameter value. Validate type per parameter (number /
  boolean / JSON). Write to SSM, record `admin_audit_log` (`action=ssm.update`, before/after).

Reuse the existing SSM read infrastructure used for quotas/caps; add a write path in the adapter.
Restrict the writable set to the allowlist above — no arbitrary SSM path writes.

## UI

Table: parameter name / current value / edit input / save button. Confirmation modal for sensitive
changes (caps, spend caps). Show last-changed-by/at from the audit log where available.

## Checklist

- [ ] `GET /admin/config` — allowlisted params + current values
- [ ] `PUT /admin/config/{param}` — type-validated write to SSM, audited
- [ ] SSM write path added to the config adapter (read path reused); writes restricted to the allowlist
- [ ] Confirmation modal on high-impact params
- [ ] `data-testid` on rows/inputs/save for E2E
- [ ] Domain unit tests with mocked SSM + audit ports
- [ ] `npm run skill:hexagonal-architecture-validator` exit 0
