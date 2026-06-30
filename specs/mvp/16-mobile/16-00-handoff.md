# 16-00 — Mobile Epic Handoff (living tracker)

**Mobile epic | Parent: [16 — Mobile Capture & Review](../16-mobile-capture-and-review.md)**

The mobile epic is too large for one pass, so it is split into independently shippable slices.
This file is the **living tracker**: update the status column as each slice lands. The parent
`16-*.md` remains the epic overview/requirements; the sub-specs below are implementation-ready
slices in build order.

> **Workflow:** implement **one slice at a time**, update this tracker + the slice's checklist,
> then **clear context between slices**. Don't carry one slice's working set into the next.

## Slices

| Slice | Title | Status | Depends on | Flutter SDK? |
|---|---|---|---|---|
| [16a](./16a-mobile-foundation.md) | Flutter foundation & app shell | ✅ | — | yes |
| [16b](./16b-mobile-auth.md) | Auth (Cognito on device) | ✅ | 16a | yes |
| [16c](./16c-mobile-capture.md) | Capture & upload vertical slice | 🚧 | 16b | yes |
| [16d](./16d-mobile-dashboard-feedback.md) | Dashboard & feedback | 🚧 | 16c | yes |
| [16e](./16e-mobile-review.md) | Review & correction (non-deferred edits) | 🚧 | 16d | yes |
| [16f](./16f-push-delivery-backend.md) | Push delivery backend | ✅ | backend only | **no** |
| [16g](./16g-push-client.md) | Push client | ⬜ | 16b + 16f | yes |
| [16h](./16h-merchant-tag-edits.md) | Merchant search + tag vocabulary (deferred) | ⬜ | 16e | both |

Status legend: ⬜ not started · 🚧 in progress · ✅ done

**Dependency DAG:** `16a → 16b → 16c → 16d → 16e → 16h`; `16f` is independent (backend only);
`16g` needs `16b` + `16f`. **16f is the only slice buildable without the Flutter SDK** — a good
first slice to ship while the toolchain is set up.

## Deferred / known gaps

- **16f built & verified (✅).** Push-delivery backend full-stack and headless-verifiable.
  Migration `device_token` (RLS `tenant_isolation`, no FORCE RLS; unique `(tenant_id,platform,token)`);
  `IDeviceTokenRepository` + `DeviceTokenRepositoryAdapter`; `POST /me/device-token` (upsert under
  `withTenantTx`, returns `{ deviceTokenId }`). `IPushNotifier.push` **extended additively** with an
  optional `PushData { type, path, invoiceId? }` (the 3 existing callers compile unchanged);
  `buildIngestionPush(status, invoiceId)` (core/domain) builds per-status copy/deep-link;
  `SnsPushNotifierAdapter` reads stage-scoped SSM ARNs, `CreatePlatformEndpoint`→`Publish` per token
  under a tenant-scoped tx, **best-effort (never throws)**, prunes on `EndpointDisabled`/`InvalidParameter`;
  `buildPushNotifier(pool)` factory (Mock on local). Worker hook fires the **PARSED/NEEDS_REVIEW**
  push post-COMMIT, and the existing **system-fault (FAILED)** + reprocessed notifications now deliver
  via the real SNS adapter with deep-link payloads. CDK: least-privilege `sns:CreatePlatformEndpoint`+
  `Publish` (IAM5-suppressed: platform-app ARNs created out-of-band), SSM read for `push/*_platform_arn`,
  commented platform-app CLI runbook. Gates: hexagonal + backend `tsc` + `validate:security` clean,
  `test:unit` 773 green (+13), infra `tsc` + `cdk synth`/cdk-nag clean.
  **Decisions:** PARSED & NEEDS_REVIEW share "ready" copy (distinct `type` for routing) per the 16d
  Ready contract; NEEDS_REVIEW is not flagged as needing review in the push. **Out of scope (noted):**
  the user-fault FAILED path (`failUserFault`, e.g. blurry/not-a-receipt) still has no in-app
  notification/push — unchanged; budget-alert pushes stay on `MockPushAdapter` (a different feature).
  **DEPLOY LANDMINE:** ① run `migrate:up` for `device_token` before the worker pushes; ② SNS platform
  apps + the two SSM ARN params are **manual** (runbook in `WobblioBackendStack`) — until they exist,
  push degrades to no-delivery (no error). Next: **16g** (token registration + deep-link routing) or **16h**.
- **16e code-complete, FULL-STACK (🚧, on-device acceptance pending).** The 07/08 correction backend
  did **not** exist — built here: migration `invoice.corrected_at`; `PUT /invoices/{id}`
  (`CorrectInvoiceService` + `IInvoiceRepository.applyCorrection`); detail now returns line
  `id`/`productId`/`confidence`; `PriceObservationInput.quality` threaded through
  `buildPriceObservations(userCorrected)` so a corrected invoice emits `USER_CONFIRMED` at the
  existing location-confirm gate. **Invariant #2 boundary** (price store has no invoice ref →
  already-emitted `AUTO` rows can't be retroactively rewritten; "repair" = corrected lines emit
  `USER_CONFIRMED` at emission, not a post-hoc update) — see memory `mobile-16e-correction-pipeline`.
  Flutter: `ReviewBloc` + `IReviewRepository`/`IProductSearchRepository` + adapters; `ReviewScreen`
  (pinch-zoom photo, amber low-confidence lines, date/total/line tap-to-fix, product-search sheet,
  Confirm/Discard); dashboard now navigates to it and refreshes on change. Backend `test:unit` 760
  green (99.01% branch), hexagonal + `tsc` + `validate:security` clean; mobile `analyze` + 47 tests +
  boundary clean. **Decisions:** discard = `DELETE`, **no quota refund** (credit model charges on
  success; refund decommissioned); amber is **line-level** (no per-field date/total confidence in the
  schema); **merchant tap-to-fix + add-tag picker deferred to 16h** (endpoints absent). Remaining:
  on-device acceptance against the **dev** backend (correct→PARSED, product search, discard).
- **16d code-complete (🚧, on-device acceptance pending).** Dashboard (`DashboardScreen` replaces the
  AppShell body): recent-invoices list with status pills, pull-to-refresh, backoff terminal polling
  (2.5/5/9s, generation-guarded), optimistic thumbs feedback, client-side tag-filter chips, weekly
  usage pill. Behind ports `IInvoiceRepository` (list + recordFeedback) + `IUsageRepository`, with
  `DashboardBloc`. `fvm flutter analyze` → 0, `fvm flutter test` → green (35). **Two contract
  decisions** (confirmed with product): (1) `NEEDS_REVIEW` shows the **green "Ready"** pill, mirroring
  the canonical webapp `invoice-map.ts` (no amber "needs review"); (2) **thumbs-down reason picker
  deferred** — the backend `/feedback` + `invoice_feedback` store only `{ verdict }`, so the
  3-chip reason + free-text would need a DDL + endpoint change; shipped verdict-only with a "Fix
  details" shortcut to 16e. **Tag filter is client-side** (the list endpoint has no tag query param).
  Row tap / thumbs-down navigate to a **16e placeholder** (`ReviewScreenPlaceholder`) that 16e
  replaces. Remaining: on-device acceptance against the **dev** backend (feedback round-trip + revert,
  tag filtering, pull-to-refresh updating list+usage, a captured row polling to terminal).
- **16c code-complete (🚧, on-device acceptance pending).** Capture flow (camera/gallery/PDF →
  EXIF-strip+compress → presign → S3 multipart POST → confirm → pop with PROCESSING snackbar) is
  implemented behind ports (`ICameraCapture`/`IGalleryPicker`/`IDocumentPicker`/`IUploadPreparer`/
  `IS3Uploader`/`IIngestionRepository`) with `CaptureBloc`. `fvm flutter analyze` → 0,
  `fvm flutter test` → green (25), hexagonal boundary clean, EXIF validator passes. **Key contract
  facts:** the S3 step is a presigned **multipart POST** (not a raw PUT), one invoice per presign
  keyed by SHA-256, **images single-page / PDF = the multipage path** (no multi-image-per-invoice
  endpoint exists). Remaining: real device/emulator capture against the **dev** backend (build with
  `--dart-define` API/Cognito values) — invoice appears + worker processes + no GPS/EXIF on the
  object + identical re-upload returns same `invoiceId` without burning quota. Native permission
  strings (iOS `NSCameraUsageDescription`/`NSPhotoLibraryUsageDescription`) are documented in
  `Source/mobile/README.md` and must be added when the native folders are (re)generated.
- **16a built & verified on Flutter 3.44.4 (FVM-pinned)** — `flutter create .` generated
  `android/`+`ios/`, `wobblio://` is registered in both native manifests, `fvm flutter analyze`
  → 0 issues, and `fvm flutter test` (smoke) → green. Toolchain: FVM 4.1.2 manages the pinned SDK
  (`.fvmrc` → 3.44.4, re-pinned from the initial 3.27.1 to match the installed stable); `.fvm/` is
  gitignored. Native folders are also gitignored (regenerated locally per `Source/mobile/README.md`).
- **`/merchants/search`** — no merchant search-as-you-type endpoint exists today (only
  `/products/search`). Required by the review screen's merchant tap-to-fix. Built in **16h**.
- **Tag-vocabulary endpoint** — the fixed tag vocabulary (§6.10.4) is not exposed over HTTP.
  Required by the review screen's add-tag picker. Built in **16h**. The dashboard tag **filter**
  (16d) reads tags already on invoices and needs no vocabulary endpoint.
- **Mobile Cognito client ID export — DONE (16b).** `WobblioAuthStack.ts` now adds `MobileClientId`
  + `CognitoDomain` `CfnOutput`s (export names `wobblio-mobile-client-id-<stage>` /
  `wobblio-cognito-domain-<stage>`), mirroring the web client ID. The device app consumes them at
  build via `--dart-define=COGNITO_CLIENT_ID/COGNITO_DOMAIN` (chose CfnOutput + dart-define over an
  SSM param + runtime bootstrap, consistent with how the web client ID is wired). **Infra owner must
  deploy `WobblioAuthStack-<stage>`** for the new exports to materialize.
- **SNS platform applications** — FCM/APNs platform apps **cannot** be created via CloudFormation;
  created once via CLI runbook, ARNs stored in SSM (see **16f**).

## Conventions for every slice

- Flutter app lives in `Source/mobile/` (created by 16a). Follow
  `.claude/rules/flutter-architecture-guard.md`: BLoC, business logic out of widgets, native
  boundaries (camera/gallery/storage/upload/push/secure-token) as **ports** with adapters.
- Backend slices follow `.claude/rules/code-quality-guard.md` (hexagonal) and must pass
  `skill:hexagonal-architecture-validator`, `test:unit`, and `validate:security` when DDL changes.
- Auth: API Gateway authorizer expects the Cognito **ID token** as `Authorization: Bearer`.
  Tenant = Cognito `sub`. Profile/role/onboarded are DB-canonical (never Cognito attributes).
