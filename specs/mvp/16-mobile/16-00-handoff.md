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
| [16c](./16c-mobile-capture.md) | Capture & upload vertical slice | ⬜ | 16b | yes |
| [16d](./16d-mobile-dashboard-feedback.md) | Dashboard & feedback | ⬜ | 16c | yes |
| [16e](./16e-mobile-review.md) | Review & correction (non-deferred edits) | ⬜ | 16d | yes |
| [16f](./16f-push-delivery-backend.md) | Push delivery backend | ⬜ | backend only | **no** |
| [16g](./16g-push-client.md) | Push client | ⬜ | 16b + 16f | yes |
| [16h](./16h-merchant-tag-edits.md) | Merchant search + tag vocabulary (deferred) | ⬜ | 16e | both |

Status legend: ⬜ not started · 🚧 in progress · ✅ done

**Dependency DAG:** `16a → 16b → 16c → 16d → 16e → 16h`; `16f` is independent (backend only);
`16g` needs `16b` + `16f`. **16f is the only slice buildable without the Flutter SDK** — a good
first slice to ship while the toolchain is set up.

## Deferred / known gaps

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
