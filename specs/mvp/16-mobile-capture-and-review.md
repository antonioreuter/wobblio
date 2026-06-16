# 16 — Mobile Capture & Review (Flutter)

**Mobile epic | Post-MVP | Depends on the backend ingestion pipeline (07)**

## Overview

The Flutter iOS/Android client: capture-first receipt scanning, the on-device review screen, push notifications, and the mobile dashboard. The backend ingestion pipeline (`07-core-ingestion-pipeline.md`) and data-intelligence layer (`08-data-intelligence-layer.md`) are reused unchanged — this epic is the mobile front-end plus the push-delivery backend that only makes sense once a mobile client exists.

This content was extracted from spec 07 when the MVP backend slice shipped without a mobile client. `Source/mobile/` does not exist yet; create it for this epic. Follow `.claude/rules/flutter-architecture-guard.md` (BLoC, ports/adapters at native boundaries).

## Dependencies

- [07 — Core Ingestion Pipeline](./07-core-ingestion-pipeline.md) (presign/confirm endpoints, worker, status machine)
- [08 — Data Intelligence Layer](./08-data-intelligence-layer.md) (merchant/product/tag vocabulary surfaced in review)
- [04 — Authentication & Waitlist](./04-authentication-waitlist.md) (Cognito session on device)

## Capture Flow

```
Camera capture / gallery pick
  → strip EXIF metadata + compress to ≤1MB JPEG (client-side, before upload)
  → POST /invoices/presign (quota check → presigned URL + invoice_id)
  → PUT bytes to S3 presigned URL (≤300s validity)
  → POST /invoices/{id}/confirm
  → return to dashboard immediately with a PROCESSING row (don't block on parse)
```

- **EXIF strip + ≤1MB JPEG compression are mandatory and client-side** (GDPR — no geotags leave the device). Verified by the `exif-data-validator` skill.
- Camera, gallery, local key-value storage, and the S3 upload are **ports** (abstract classes) implemented in the adapters layer; BLoCs/domain never import native/concrete adapters.
- Multi-page receipt support: multiple images uploaded for one `invoice_id`.

## Review Screen

- Vertically split: zoomable (pinch-to-zoom) receipt photo (top), scrollable parsed fields (bottom)
- Low-confidence (`LOW_CONFIDENCE`) fields pre-highlighted amber
- Merchant tap-to-fix: search-as-you-type against the merchant table → writes `USER_CONFIRMED` alias
- Date tap-to-fix: date picker
- Total tap-to-fix: numeric input
- Line-item tap-to-fix bottom sheet: product search-as-you-type, size/unit edit, price edit
- Tag chip row: removable chips + add-tag picker over the fixed vocabulary (§6.10.4)
- Single sticky `Confirm` button: saves corrections, flips status to `PARSED`, triggers trust/alias updates and `quality=USER_CONFIRMED` price-observation repair
- `Discard` button for `SUSPECTED_DUPLICATE` (no price observation, quota refunded)
- Target: clean receipt confirmed in one tap, messy receipt in <30 seconds

## Push Notifications

After the worker writes terminal status:
- `PARSED`: push → deep-link to invoice card
- `NEEDS_REVIEW`: push → deep-link to review screen
- `FAILED_PROCESSING`: push with "tap to retry or contact support"

Backend delivery (new in this epic):
- SNS mobile push: FCM (Android) + APNs (iOS). **SNS platform applications cannot be created via CloudFormation** — create once via AWS CLI after credentials land in SSM (see the commented runbook in `WobblioBackendStack`), store the returned `PlatformApplicationArn` in SSM.
- `POST /me/device-token` endpoint to register a device token.
- Device-token storage: add a `device_token` table (`id`, `user_id`, `token`, `platform ENUM(FCM,APNS)`, `created_at`, `last_error_at NULL`) via migration — RLS tenant-scoped.
- Prune device tokens on SNS delivery failure (`EndpointDisabled`).
- Push payload: notification type, `invoice_id`, deep-link path.

## Dashboard & Feedback

- Recent-invoices list: merchant avatar, merchant name, date, total, status pill (`Processing...` shimmer, `Needs review` amber tap-target, `Parsed` green)
- Pull-to-refresh
- Thumbs up/down affordance on the invoice card; thumbs-down opens the 3-chip reason picker + optional free-text + shortcut to the correction screen (writes `invoice_feedback`)
- Tag filter: horizontally scrolling tag chip row above the recent-invoices list (`search_tags && ARRAY[...]`, GIN-backed; free-tier 2-month window, premium full history)

---

## Checklist

### Capture
- [ ] EXIF strip + ≤1MB JPEG compression client-side before S3 PUT (verified by `exif-data-validator`)
- [ ] Camera / gallery / storage / upload defined as ports, implemented in adapters layer
- [ ] presign → PUT → confirm flow against the 07 backend endpoints
- [ ] Multi-page receipt support (multiple images per `invoice_id`)
- [ ] Capture returns to dashboard immediately with a PROCESSING row

### Review Screen
- [ ] Split layout: pinch-to-zoom image (top), scrollable fields (bottom)
- [ ] Amber highlight on `LOW_CONFIDENCE` fields
- [ ] Merchant / date / total tap-to-fix
- [ ] Line-item tap-to-fix bottom sheet: product search, size/unit edit, price edit
- [ ] Tag chip row with removable chips + vocabulary picker (§6.10.4)
- [ ] Confirm button: saves corrections, flips to `PARSED`, triggers trust/alias updates
- [ ] Discard button for `SUSPECTED_DUPLICATE`

### Push Notifications
- [ ] SNS platform applications: FCM (Android) + APNs (iOS), created via CLI runbook, ARN in SSM
- [ ] `POST /me/device-token` registration endpoint
- [ ] `device_token` table migration (RLS tenant-scoped)
- [ ] Device-token pruning on `EndpointDisabled`
- [ ] Worker → push payload: notification type, `invoice_id`, deep-link path

### Dashboard & Feedback
- [ ] Recent-invoices list with status pill + pull-to-refresh
- [ ] Thumbs up/down + 3-chip reason picker → `invoice_feedback`
- [ ] Mobile tag-filter chip row

### Architecture
- [ ] BLoC state management; business logic in domain/BLoC, never in widgets
- [ ] Flutter analyzer + widget tests green before commit
