# 03 — Model-Swap Matrix

**Epic 10 | Phase 5 | Live swapping of Bedrock model IDs by role**

## Overview

Live swapping of the four AI model IDs by role. Each role's model ID is an opaque SSM value; changing
it lets a running fleet pick up a new model on the next cold start or SSM cache expiry. Swaps are
high-impact, so they are gated by a warning modal and audited.

**Folded-in prerequisite:** no adapter currently reads `/wobblio/config/models/*`. This sub-spec owns
that adapter — it is the canonical reader for both this matrix and the ingestion worker.

Parent: [12 — Admin Console](../12-admin-console.md).

## Dependencies

- [00 — Access Control, Routing & Audit](./00-access-control-routing-audit.md) (admin route module + audit log)
- [08 — Data Intelligence Layer](../08-data-intelligence-layer.md) (consumers of the model IDs)

## SSM model adapter (prerequisite — folded in)

Model IDs live at `/wobblio/config/models/{vision_parser,auxiliary,insight,embedder}` (per root
CLAUDE.md and `Source/backend/CLAUDE.md`). No code reads them yet.

- Port `IModelRegistry` in `core/ports/ai/` with `getModelId(role)` and `setModelId(role, id)`.
- Adapter `SsmModelRegistryAdapter` in `infrastructure/adapters/ai/` reading/writing the four SSM paths.
- The ingestion worker and any Bedrock caller resolve model IDs through this adapter — never hardcode.

## Endpoints

- `GET /admin/models` — current model IDs for all 4 roles (via `IModelRegistry`).
- `PUT /admin/models/{role}` — update one role's model ID. `role` restricted to the 4 known roles.
  Write to SSM, record `admin_audit_log` (`action=model.swap`, before/after = old/new id).

## UI

Matrix per parent §66-77: role / current ID / new-ID text input / confirm button. Confirmation modal
text: "Changing vision_parser will affect all new ingestions. The DOWN-ratio alarm is the canary for a
bad swap — monitor it for 30 minutes after swapping." Swap history is the filtered audit log
(`action=model.swap`).

## Checklist

- [ ] `IModelRegistry` port + `SsmModelRegistryAdapter` reading/writing `/wobblio/config/models/*`
- [ ] Ingestion worker / Bedrock callers resolve model IDs via the adapter (no hardcoded IDs)
- [ ] `GET /admin/models` — 4 role IDs
- [ ] `PUT /admin/models/{role}` — role-allowlisted write to SSM, audited
- [ ] Warning modal with DOWN-ratio monitoring guidance
- [ ] Swap-history view (filtered audit log)
- [ ] `data-testid` on matrix rows/inputs/confirm
- [ ] Domain unit tests with mocked registry + audit ports
- [ ] `npm run skill:hexagonal-architecture-validator` exit 0
