# 16f — Push Delivery Backend

**Mobile epic | Parent: [16](../16-mobile-capture-and-review.md) · Tracker: [16-00](./16-00-handoff.md)**

The push-delivery backend that only makes sense once a mobile client exists: a device-token table,
a registration endpoint, an SNS adapter implementing the **already-abstracted** push port, and the
ingestion-worker hook that fires on terminal status. **This slice needs no Flutter SDK** — it is the
recommended first slice to ship while the toolchain is set up.

## Dependencies
- [07](../07-core-ingestion-pipeline.md) (ingestion worker, terminal status)
- [02](../02-infrastructure-database-rls.md) (RLS migration patterns)
- Existing: `core/ports/notifications/IPushNotifier.ts` + `MockPushAdapter` (already injected into
  the worker/budget paths — the SNS adapter is a drop-in).

## Scope

### `device_token` table (RLS tenant-scoped)
Migration via the `database-migrations` skill (node-pg-migrate):
- Columns: `id`, `tenant_id UUID → app_user(id) ON DELETE CASCADE`, `platform TEXT CHECK (platform
  IN ('FCM','APNS'))`, `token TEXT`, `last_error_at TIMESTAMPTZ NULL`, `created_at TIMESTAMPTZ`.
- Unique `(tenant_id, platform, token)`; index on `tenant_id`.
- **RLS enabled**, tenant-isolation policy `tenant_id = current_setting('app.current_tenant_id',
  true)::uuid` (same pattern as other user-owned tables; no `FORCE RLS` — memory `rls-app-role`).

### `POST /me/device-token` endpoint
- In `api-handler/index.ts` (or a `notificationRoutes.ts`): accept `{ platform, token }`, upsert
  under tenant context (`withTenantTx`), respond `{ deviceTokenId }`. Role-agnostic (any authed user).

### `SnsPushNotifierAdapter implements IPushNotifier`
- `infrastructure/adapters/notifications/SnsPushNotifierAdapter.ts`. Reads platform-application ARNs
  from **stage-scoped SSM** (`stageScopeConfig`, memory `stage-scoped-ssm-config`):
  `/wobblio/config/<stage>/push/fcm_platform_arn`, `.../apns_platform_arn`.
- For each of the tenant's device tokens: `CreatePlatformEndpoint` → `Publish` (platform-specific
  payload). **Best-effort**: never throw into the caller (worker/cron) — catch + log.
- Push payload: notification type, `invoiceId`, deep-link path.
- **Prune on `EndpointDisabled` / `InvalidParameter`**: set `last_error_at` and delete the dead
  token so it isn't retried.

### SNS platform-application runbook (manual)
- SNS platform apps **cannot** be created via CloudFormation. Document a CLI runbook (FCM = GCM;
  APNs = `APNS_SANDBOX` for dev, `APNS` for prod) run once after FCM/APNs credentials land in SSM;
  store the returned `PlatformApplicationArn` in the SSM params above. Mirror the commented runbook
  in `WobblioBackendStack`. Grant the relevant Lambda role least-privilege `sns:CreatePlatformEndpoint`
  + `sns:Publish` on those ARNs only.

### Worker hook
- After the ingestion worker writes terminal status, call `IPushNotifier.push(...)` with the
  per-status payload (PARSED / NEEDS_REVIEW / FAILED_PROCESSING → deep-link path), wrapped in
  try/catch so push failure never fails or retries the message.

## Reuse references
- `core/ports/notifications/IPushNotifier.ts`, `MockPushAdapter` (contract + structure).
- `core/services/budgets/BudgetRecyclerService.ts` (existing best-effort push usage).
- `infrastructure/config/stageConfig.ts` (`stageScopeConfig`).
- A prior RLS migration (e.g. households/invites) as the table-policy template.

## Out of scope
- Flutter token registration + deep-link routing (16g).

## Checklist
- [x] `device_token` migration: columns, unique `(tenant_id,platform,token)`, RLS policy (no FORCE RLS)
- [x] `POST /me/device-token` upsert under tenant context
- [x] `SnsPushNotifierAdapter` reads ARNs from stage-scoped SSM; best-effort; never throws
- [x] Prune dead tokens on `EndpointDisabled`
- [x] SNS platform-app CLI runbook documented; ARNs in SSM (manual); least-privilege IAM (IAM5-suppressed)
- [x] Worker terminal-status push hook (PARSED / NEEDS_REVIEW / FAILED) in try/catch
- [x] `skill:hexagonal-architecture-validator` exit 0
- [x] `npm run test:unit` (mocked SNS/SSM + repo) + `npm run validate:security` (new RLS table) green

## Verification
- Migration up/down clean on the local sandbox; `validate:security` confirms RLS on `device_token`.
- Unit tests: worker fires `push(...)` exactly once per terminal status with the right payload; a
  thrown SNS error does **not** fail the message.
- A registered token receives a test push; an `EndpointDisabled` response prunes the row.
