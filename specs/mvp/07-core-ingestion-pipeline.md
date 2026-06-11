# 07 — Core Ingestion Pipeline

**Epic 6 | Phase 3 | The product's core value delivery**

## Overview

The end-to-end receipt ingestion pipeline: presigned S3 upload → SQS → worker Lambda executing the full 5-stage data-intelligence pipeline → review screen on both clients. The quality flywheel (review screen + feedback) must ship with the worker — not later.

## Dependencies

- [02 — Infrastructure, Database & RLS](./02-infrastructure-database-rls.md)
- [03 — Observability Foundation](./03-observability-foundation.md)
- [04 — Authentication & Waitlist](./04-authentication-waitlist.md)
- [08 — Data Intelligence Layer](./08-data-intelligence-layer.md) (runs in the same worker)

## Pipeline Architecture

```
Client (mobile/web)
  → compress image client-side
  → POST /invoices/presign (check quota, return presigned URL + invoice_id)
  → PUT to S3 presigned URL
  → POST /invoices/{id}/confirm (triggers S3 → SQS event)
  → return to dashboard with PROCESSING row

S3 event → SQS ingestion queue (maxConcurrency 5)
  → ingestion worker Lambda:
      1. Idempotency: INSERT ingestion_ledger ON CONFLICT DO NOTHING
      2. Deduplication (image hash + fuzzy fingerprint)
      3. Vision parse (Bedrock, B.1)
      4. Merchant canonicalization (§6.2)
      5. Product normalization & categorization (§6.3)
      6. Invoice classification (§6.4)
      7. Tag generation (§6.10)
      8. Write tenant tables (invoice, invoice_line) — RLS
      9. Emit price observations (anonymized, no RLS)
      10. Push notification on completion
```

## Invoice Status State Machine

```
PROCESSING → NEEDS_REVIEW (any stage below confidence threshold)
           → PARSED (all stages above threshold)
           → FAILED_PROCESSING → DLQ (after 3 SQS attempts)
           → SUSPECTED_DUPLICATE (fuzzy fingerprint match)
           → DISCARDED (user confirms duplicate or deletes)
```

## Presign URL Flow

`POST /invoices/presign`:
- Enforces personal upload quota (or household quota if `household_id` provided)
- Creates `invoice` row with `status=PROCESSING`
- Writes `ingestion_ledger` entry
- Returns presigned S3 PUT URL (30-min expiry) + `invoice_id`
- Client compresses image to ≤1MB JPEG before upload

`POST /invoices/{id}/confirm`:
- Verifies S3 object exists (HEAD request)
- Enqueues message to SQS ingest queue
- Returns `202 Accepted`

## Deduplication (Two Layers)

**Layer 1 — Exact hash:** SHA-256 of uploaded bytes, unique per tenant. Same photo uploaded twice → reject at confirm time, "already scanned" response, zero AI tokens.

Cross-tenant SHA-256 check: collision across unrelated accounts → invoice not rejected (printed duplicates can exist), but catalog corroboration voided + cluster flagged.

**Layer 2 — Fuzzy fingerprint:** after parsing, check `(merchant_id, transaction_date, total, line_count)` per tenant. Match → mark `SUSPECTED_DUPLICATE`, review screen prompts user to confirm or discard.

Confirmed duplicates: emit no price observations, do not consume quota.

## Worker Contract (SQS Consumer)

- First action: `INSERT ingestion_ledger ... ON CONFLICT DO NOTHING` (transport idempotency)
- All downstream writes inside one transaction keyed to ledger row
- Partial batch failure: `ReportBatchItemFailures` so one poisoned message doesn't recycle batch
- maxReceiveCount 3 → DLQ
- Per-stage CloudWatch metrics (duration, tokens, cost) via EMF
- Per-tenant daily AI spend cap enforced (SSM parameter, `ai_spend_ledger` write)

## Confidence Thresholds and NEEDS_REVIEW Triggers

Any of the following → invoice moves to `NEEDS_REVIEW`:
- Vision parse confidence < 0.7
- Arithmetic sanity check fails (Σ line_totals vs. receipt total >€0.05 or >1%)
- Merchant resolved with confidence < threshold (fuzzy match margin < 0.15, or LLM confidence < 0.7)
- Any product line in the 0.85–0.92 embedding similarity band (`LOW_CONFIDENCE`)
- Fuzzy duplicate fingerprint match (`SUSPECTED_DUPLICATE` — separate status)

## Review Screen Requirements

**Mobile (Flutter):**
- Vertically split: zoomable receipt photo (top), parsed fields (bottom)
- Low-confidence fields pre-highlighted amber
- Tap-to-fix opens bottom sheet: product search-as-you-type, size fix, price fix
- Tag chip row: removable chips + add-tag picker over fixed vocabulary
- Single sticky `Confirm` button
- Target: clean receipt in one tap, messy receipt in <30 seconds

**Web (Next.js):**
- Right inspection drawer: side-by-side photo + fields (mirrors mobile)
- `NEEDS_REVIEW` rows surfaced in a banner queue at top of Invoices page
- Same correction capabilities as mobile

## Push Notifications

After worker completes:
- `PARSED`: push notification → deep-link to invoice card
- `NEEDS_REVIEW`: push notification → deep-link to review screen
- `FAILED_PROCESSING`: push notification with "tap to retry or contact support"
- SNS mobile push (FCM for Android, APNs for iOS), device tokens stored in `app_user`, pruned on delivery failure

## User Feedback (Thumbs Up/Down)

After invoice reaches `PARSED` (or after review confirmation):
- Mobile: unobtrusive thumbs-up/down on invoice card
- Web: same on invoice row / drawer
- Thumbs-down: opens 3-chip reason picker (`Wrong items`, `Wrong merchant/total`, `Other`) + optional free-text + shortcut to correction screen
- Stored in `invoice_feedback` with `model_ids_snapshot` (model IDs + prompt versions)
- Feeds: KPI aggregation, trust scoring, DOWN-ratio alarm, evaluation set

---

## Checklist

### Presign & Upload
- [ ] `POST /invoices/presign` endpoint: quota check, `invoice` row creation, S3 presigned PUT URL
- [ ] S3 event → SQS message wiring (S3 notification on `ObjectCreated`)
- [ ] `POST /invoices/{id}/confirm` endpoint: S3 HEAD check, SQS enqueue
- [ ] Client-side image compression (≤1MB JPEG) in Flutter + Next.js
- [ ] Multi-page receipt support: multiple images uploaded for one `invoice_id`

### Ingestion Worker Lambda
- [ ] SQS event source mapping: `maxConcurrency: 5`, `ReportBatchItemFailures: true`
- [ ] Transport idempotency: `INSERT ingestion_ledger ON CONFLICT DO NOTHING`
- [ ] Full pipeline execution in sequence (see pipeline order above)
- [ ] Single DB transaction per ingestion run wrapping all writes
- [ ] Partial batch failure response on exceptions
- [ ] DLQ routing after 3 failures (maxReceiveCount: 3)

### Deduplication
- [ ] SHA-256 image hash stored at presign time in `invoice.image_sha256`
- [ ] Cross-tenant SHA-256 collision check (hash only, no content crossing tenant boundary)
- [ ] Fuzzy fingerprint check: `(merchant_id, transaction_date, total, line_count)` per tenant scope
- [ ] `SUSPECTED_DUPLICATE` status + review screen prompt
- [ ] Confirmed duplicate: no price observation emitted, quota refunded

### Vision Parse (Stage 1 — see also Epic 08)
- [ ] Bedrock Converse API call with vision_parser model (SSM-configured)
- [ ] JSON schema validation (zod or ajv)
- [ ] Retry once with validation errors appended to prompt on failure
- [ ] Arithmetic sanity check: Σ line_totals reconciles with total within €0.05 or 1%
- [ ] Route to DLQ on second failure
- [ ] `parse_confidence` stored on invoice; <0.7 → `NEEDS_REVIEW`

### Invoice Status Updates
- [ ] Status transitions: PROCESSING → PARSED / NEEDS_REVIEW / FAILED_PROCESSING / SUSPECTED_DUPLICATE
- [ ] All status-update writes within the ingestion transaction
- [ ] Worker emits invoice status to push notification on completion

### Push Notifications
- [ ] SNS platform applications: FCM (Android) and APNs (iOS) in CDK
- [ ] Device token registration endpoint: `POST /me/device-token`
- [ ] Device token storage in `app_user` or dedicated table
- [ ] Device token pruning on SNS delivery failure (EndpointDisabled)
- [ ] Push payload: notification type, `invoice_id`, deep-link path

### Review Screen — Mobile (Flutter)
- [ ] Split layout: pinch-to-zoom receipt image (top), scrollable parsed fields (bottom)
- [ ] Amber highlight on `LOW_CONFIDENCE` fields
- [ ] Merchant tap-to-fix: search-as-you-type against merchant table
- [ ] Date tap-to-fix: date picker
- [ ] Total tap-to-fix: numeric input
- [ ] Line item tap-to-fix bottom sheet: product search, size/unit edit, price edit
- [ ] Tag chip row with removable chips and vocabulary picker (§6.10.4)
- [ ] Confirm button: saves corrections, flips to `PARSED`, triggers trust/alias updates
- [ ] Discard button for `SUSPECTED_DUPLICATE`

### Review Screen — Web (Next.js)
- [ ] Collapsible right inspection drawer on Invoices page
- [ ] Side-by-side photo + fields
- [ ] `NEEDS_REVIEW` banner queue at top of Invoices table
- [ ] Same correction capabilities as mobile
- [ ] Tag chip row matching mobile design

### User Feedback
- [ ] Thumbs up/down affordance on invoice card (mobile) and row/drawer (web)
- [ ] Thumbs-down: 3-chip reason picker + optional free-text
- [ ] Shortcut to correction screen from thumbs-down flow
- [ ] `invoice_feedback` write with `model_ids_snapshot` (model IDs + prompt versions)

### Invoice List / Dashboard
- [ ] Dashboard recent invoices list: merchant avatar, merchant name, date, total, status pill
- [ ] Status pill: `Processing...` shimmer, `Needs review` amber tap-target, `Parsed` green
- [ ] Pull-to-refresh on mobile
- [ ] Capture flow returns to dashboard immediately with Processing row (don't wait for parse)

### Tag Filter (see §6.10.6)
- [ ] Mobile: horizontally scrolling tag chip row above recent-invoices list
- [ ] Web: tag filter chips on Invoices page alongside saved filters
- [ ] Filter query: `search_tags && ARRAY[...]` (any-of) backed by GIN index
- [ ] Free-tier: filter within 2-month window; premium: full history
