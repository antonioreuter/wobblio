# 14b — Data Export (GDPR Art. 20)

**Epic 14 | Parent: [14](../14-gdpr-data-lifecycle.md) · Tracker: [00-handoff](./00-handoff.md)**

Status: ✅ done

## Dependencies

- [02](../02-infrastructure-database-rls.md) (RLS, `data_request` table — already existed)
- Existing: `IZipArchiver`/`JsZipArchiverAdapter` (admin family), `IS3FileStorage` (ingestion family),
  `IEmailSender`/`SesEmailAdapter`, `IPushNotifier`/`SnsPushNotifierAdapter`.

## Scope

### Migration

**None.** `data_request` (id, tenant_id, kind, status, export_s3_key, requested_at, completed_at) +
its `tenant_isolation` RLS policy already exist verbatim in the initial schema migration
(`20260611152000_initial_schema.ts`).

### New family: `gdpr`

`core/services/gdpr/`, `core/ports/gdpr/`, `infrastructure/adapters/gdpr/` — new capability area per
`Source/backend/CLAUDE.md`'s mirrored-family convention.

### Domain
- `core/domain/csv.ts` — `toCsv(headers, rows)`, RFC4180 quoting, no new dependency.
- `core/domain/errors.ts` — `ExportRateLimitedError`, `DataRequestNotFoundError(requestId)`.

### Ports (`core/ports/gdpr/`)
- `IDataRequestRepository`: `hasRecentExportRequest`, `createExportRequest`, `getExportById`
  (RLS-scoped, cross-tenant → null), `markCompleted`, `markFailed`.
- `IExportQueue`: `enqueue({ requestId, tenantId })`.
- `IExportDataSource`: dedicated lean read contract (`getAccount`, `listInvoices`,
  `listInvoiceLines`, `listShoppingLists`, `listBudgets`, `listReceiptImageKeys`) — deliberately not
  reusing the feature repositories, which carry internal fields that must never leak into an export.
- `core/ports/ingestion/IS3FileStorage` extended additively: `putObject(key, bytes, contentType)`.
- `core/ports/notifications/IEmailSender` extended additively: `sendExportReady(toAddress)` — no raw
  download URL in the copy (decision #2 in the handoff).

### Services (`core/services/gdpr/`)
- `RequestExportService.request(tenantId)` — rate-limit guard (excludes `FAILED` rows per decision
  #5) → `createExportRequest` → `queue.enqueue`.
- `ExportWorkerService.run(requestId, tenantId)` — idempotent short-circuit if already `COMPLETED`;
  fetches all 5 data sources in parallel; tolerant image fetch via `Promise.allSettled` (mirrors
  `AdminDebugSampleService`); builds ZIP entries (JSON+CSV per table + `receipts/`); `putObject` to
  `{tenantId}/{requestId}.zip`; `markCompleted`.
- `ResolveExportDownloadService.resolve(requestId)` — 404 if unknown; non-`COMPLETED` status returns
  no URL; `COMPLETED` + object gone (past the 7-day lifecycle rule) → derived `EXPIRED` (never
  persisted); `COMPLETED` + object present → fresh 300s `presignGet` URL minted every call.
- `GetLatestExportService.getLatest(tenantId)` — most recent EXPORT `data_request` row or null,
  backs `GET /me/export/latest` (not explicitly named in the parent spec, added to give the settings
  page a way to discover request state without client-side persistence of a `request_id`).

### Adapters (`infrastructure/adapters/gdpr/`)
- `DataRequestRepositoryAdapter` — RLS-scoped `pg` queries, `Pool | PoolClient` constructor
  (mirrors `AppUserRepositoryAdapter`).
- `SqsExportQueueAdapter` — mirrors `SqsInvoiceIngestionQueueAdapter`.
- `ExportDataSourceAdapter` — explicit SELECTs per table, joins global catalog tables for
  human-readable names.
- `S3FileStorageAdapter.putObject` — new `PutObjectCommand` implementation.
- `SesEmailAdapter.sendExportReady` — inline subject/body, no link.

### Handler routes

`Source/backend/src/handlers/api-handler/gdprRoutes.ts`, dispatched from `handleMeRoute`:
- `POST /me/export` → `202 { requestId }`, `429` on `ExportRateLimitedError`.
- `GET /me/export/latest` → `200 { request: null | {...} }`.
- `GET /me/export/{id}/download` → `200 { status, downloadUrl }`, `404` on unknown id.

### New worker Lambda

`Source/backend/src/handlers/export-worker/index.ts` — dedicated SQS consumer (not reusing
`ingestionWorkerShell.ts`, which is purpose-built for charging/telemetry/budget-alerts). Per-record:
tenant tx → `ExportWorkerService.run` → best-effort post-commit `sendExportReady` email + push.
`ReportBatchItemFailures` on error, `maxReceiveCount=3` → DLQ.

### CDK

New `exportDlq` + `exportQueue` (KMS, mirrors `ingestionQueue`), `exportWorkerFn` (concurrency 2,
90s timeout), SQS event source, grants (`uploadsBucket.grantRead`, `exportsBucket.grantReadWrite`,
queue send/consume, KMS, DB secret), `EXPORT_QUEUE_URL` env on the api-handler.

## Out of scope (belongs to later slices / not this pass)

- Any change to account deletion (14c/14d).
- App-level KMS envelope encryption of `export_s3_key` (decision #4: plaintext + bucket SSE-KMS).
- A hard per-tenant export size cap (documented assumption, not enforced).

## Checklist

- [x] `data_request` confirmed pre-existing, no migration needed
- [x] `core/domain/csv.ts` + RFC4180 escaping
- [x] `IDataRequestRepository` / `IExportQueue` / `IExportDataSource` ports
- [x] `IS3FileStorage.putObject` additive extension
- [x] `IEmailSender.sendExportReady` additive extension, no raw link
- [x] `RequestExportService` (24h rate limit, FAILED excluded)
- [x] `ExportWorkerService` (idempotent, tolerant image fetch, ZIP build, upload)
- [x] `ResolveExportDownloadService` (fresh 300s URL per call, derived EXPIRED)
- [x] `GetLatestExportService`
- [x] `gdprRoutes.ts` — `POST /me/export`, `GET /me/export/latest`, `GET /me/export/{id}/download`
- [x] `export-worker` Lambda + SQS queue/DLQ + CDK grants
- [x] Unit tests: csv, RequestExportService, ExportWorkerService, ResolveExportDownloadService
- [x] `skill:hexagonal-architecture-validator` exit 0
- [x] `npm run test:unit` green
- [x] `npm run validate:security` green
- [x] `cdk synth` + cdk-nag clean

## Verification

- `POST /me/export` for a seeded tenant with invoices → `202`; `export-worker` picks up the SQS
  message; `data_request.status` flips `PENDING`→`COMPLETED`.
- `GET /me/export/latest` reflects the request; `GET /me/export/{id}/download` returns a working
  presigned URL that downloads a ZIP containing `invoices.json/csv`, `invoice_lines.json/csv`,
  `shopping_lists.json/csv`, `budgets.json/csv`, `account.json`, `receipts/*`.
- Second `POST /me/export` within 24h → `429`; a `FAILED` row doesn't block a same-day retry.
