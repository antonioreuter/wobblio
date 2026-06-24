# 12c — Config Editor & Model-Swap Matrix

**Epic 10 | Phase 5 | Parent: [12 — Admin Console](./12-admin-console.md)**

Live editing of tunable SSM parameters and AI model IDs. Grouped because both are
get/put-against-SSM behind one shared config port.

## Dependencies

- [12a — Admin Foundation](./12a-admin-foundation.md)
- [08 — Data Intelligence Layer](./08-data-intelligence-layer.md) (model roles)

## Backend

Endpoints (ADMIN-gated, mutations audit-logged):

- `GET /admin/config` — list all editable params with current values.
- `PUT /admin/config/{param}` — update one param value.
- `GET /admin/models` — current model IDs for the 4 roles.
- `PUT /admin/models/{role}` — update one model ID (`vision_parser|auxiliary|insight|embedder`).

### New shared config port

`core/ports/admin/IAdminConfigStore.ts` — `getParameters(names)`, `putParameter(name, value)`.
Adapter `infrastructure/adapters/admin/SsmAdminConfigAdapter.ts` wraps `SSMClient`
Get/PutParameter. This generalizes the scattered read-only `Ssm*Adapter`s; **do not** add Put to
those — keep this the single write path so all SSM mutations funnel through one audited port.

### Editable-parameter whitelist (server-enforced)

Reject any `param` not on the list. Initial set (from §6.1 / spec §12):

- `max_free_users_cap`
- `ai/daily_spend_cap`
- `routing/min_split_saving`, `routing/max_stores`
- `tags/vocabulary` (JSON), `tags/dedicated_call_enabled` (bool)
- per-model token ceilings (vision_parser, auxiliary, insight, embedder)
- 4 model IDs: `/wobblio/config/models/{vision_parser,auxiliary,insight,embedder}`

Validate type per param (number / bool / JSON / string) before write; 400 on mismatch.

Changes take effect on the next Lambda warm start or SSM cache expiry — surface that latency
note in the UI.

## Frontend (`Source/admin/`)

- `(console)/config/page.tsx` — table: name / current value / edit input / save. Confirmation
  modal for high-impact params (cap changes).
- `(console)/models/page.tsx` — the swap matrix (4 rows). Confirmation modal copy: *"Changing
  vision_parser affects all new ingestions. The DOWN-ratio alarm is the canary for a bad swap —
  monitor it for 30 minutes after swapping."*

## Open decisions

- `tags/vocabulary` is large JSON — edit as raw JSON with client-side parse validation before
  `PUT`; reject invalid JSON server-side too.

## Checklist

- [ ] `IAdminConfigStore` port + `SsmAdminConfigAdapter` (Get/Put), single audited write path
- [ ] `GET /admin/config`, `PUT /admin/config/{param}` with whitelist + per-type validation
- [ ] `GET /admin/models`, `PUT /admin/models/{role}` (role enum guard)
- [ ] Every PUT audit-logged (before/after value)
- [ ] `config/page.tsx` + `models/page.tsx`, confirmation modals
- [ ] Unit tests: whitelist rejection, type validation, audit on success
- [ ] Hexagonal validator exit 0; `npm run validate:security` if IAM/SSM policy touched

## Verification

- `PUT /admin/config/max_free_users_cap` with a valid number updates SSM; `GET` reflects it;
  audit row has before/after.
- Non-whitelisted param or wrong type → 400, no SSM write.
- `PUT /admin/models/vision_parser` updates the SSM model ID; ingestion worker picks it up on
  next cold start.
