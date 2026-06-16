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
Client (web; mobile capture/review deferred — see 16-mobile-capture-and-review.md)
  → compress image client-side
  → POST /invoices/presign (check quota, return presigned URL + invoice_id)
  → PUT to S3 presigned URL
  → POST /invoices/{id}/confirm (verify S3 object via HEAD, then enqueue SQS message)
  → return to dashboard with PROCESSING row

confirm endpoint → SQS ingestion queue (payload: invoice_id, tenant_id, s3_key; maxConcurrency 5)
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
- Creates `invoice` row with `status=PROCESSING` (inside a transaction with `app.current_tenant_id` set — RLS)
- Returns presigned S3 PUT URL (**≤300s / 5-min expiry**, per hard invariant #10) + `invoice_id`
- Client compresses image to ≤1MB JPEG before upload
- Does **not** write `ingestion_ledger` — that row is written by the worker as its first action (transport idempotency). `ingestion_ledger` is keyed on the S3 object key; a presign-time insert would make every worker delivery short-circuit as a duplicate.

`POST /invoices/{id}/confirm`:
- Verifies S3 object exists (HEAD request); if missing or stale (>300s past presign, URL expired) → `410 Gone`, client re-initiates presign
- Enqueues message directly to the SQS ingest queue (`invoice_id`, `tenant_id`, `s3_key`) — there is **no** S3 `ObjectCreated` notification
- Returns `202 Accepted`

## Deduplication (Two Layers)

**Layer 1 — Exact hash:** SHA-256 of uploaded bytes, unique per tenant. Same photo uploaded twice → reject at confirm time, "already scanned" response, zero AI tokens.

Cross-tenant SHA-256 check: collision across unrelated accounts → invoice not rejected (printed duplicates can exist), but catalog corroboration voided + cluster flagged.

**Layer 2 — Fuzzy fingerprint:** after parsing, check `(merchant_id, transaction_date, total, line_count)` per tenant. Match → mark `SUSPECTED_DUPLICATE`, review screen prompts user to confirm or discard.

Confirmed duplicates: emit no price observations, do not consume quota.

## Worker Contract (SQS Consumer)

- First action: `INSERT ingestion_ledger ... ON CONFLICT DO NOTHING` (transport idempotency); `rowCount === 0` → duplicate delivery, short-circuit
- Set `app.current_tenant_id` (from the SQS message) before any tenant-scoped write — RLS
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

**Web (Next.js):**
- Right inspection drawer: side-by-side photo + fields
- `NEEDS_REVIEW` rows surfaced in a banner queue at top of Invoices page
- Correction capabilities: merchant/date/total tap-to-fix, line-item edit, tag chip row

> **Mobile (Flutter) review screen is deferred to `16-mobile-capture-and-review.md`.**

## Completion Status & Notifications

After the worker completes it writes the terminal status (`PARSED` / `NEEDS_REVIEW` / `FAILED_PROCESSING`) to the `invoice` row; web clients surface it via dashboard refresh.

> **Push notifications (SNS FCM/APNs, `POST /me/device-token`, device-token storage & pruning, deep-links) are deferred to `16-mobile-capture-and-review.md`** — they only matter once the mobile client exists.

## User Feedback (Thumbs Up/Down)

After invoice reaches `PARSED` (or after review confirmation):
- Web: thumbs-up/down on invoice row / drawer
- Thumbs-down: opens 3-chip reason picker (`Wrong items`, `Wrong merchant/total`, `Other`) + optional free-text + shortcut to correction screen
- Stored in `invoice_feedback` with `model_ids_snapshot` (model IDs + prompt versions)
- Feeds: KPI aggregation, trust scoring, DOWN-ratio alarm, evaluation set

> Mobile feedback affordance is deferred to `16-mobile-capture-and-review.md`.

---

## Checklist

### Presign & Upload
- [ ] `POST /invoices/presign` endpoint: quota check, `invoice` row creation (no ledger write), S3 presigned PUT URL (≤300s)
- [ ] `POST /invoices/{id}/confirm` endpoint: S3 HEAD check, enqueue SQS message directly (no S3 `ObjectCreated` notification)
- [ ] Client-side image compression (≤1MB JPEG) in Next.js (Flutter deferred — see 16)
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
- [ ] Worker writes terminal status to the `invoice` row on completion

### Review Screen — Web (Next.js)
- [ ] Collapsible right inspection drawer on Invoices page
- [ ] Side-by-side photo + fields
- [ ] `NEEDS_REVIEW` banner queue at top of Invoices table
- [ ] Correction capabilities: merchant/date/total/line-item edits
- [ ] Tag chip row with removable chips and vocabulary picker (§6.10.4)

### User Feedback (Web)
- [ ] Thumbs up/down affordance on invoice row/drawer
- [ ] Thumbs-down: 3-chip reason picker + optional free-text
- [ ] Shortcut to correction screen from thumbs-down flow
- [ ] `invoice_feedback` write with `model_ids_snapshot` (model IDs + prompt versions)

### Invoice List / Dashboard (Web)
- [ ] Dashboard recent invoices list: merchant avatar, merchant name, date, total, status pill
- [ ] Status pill: `Processing...` shimmer, `Needs review` amber tap-target, `Parsed` green
- [ ] Capture flow returns to dashboard immediately with Processing row (don't wait for parse)

### Tag Filter — Web (see §6.10.6)
- [ ] Tag filter chips on Invoices page alongside saved filters
- [ ] Filter query: `search_tags && ARRAY[...]` (any-of) backed by GIN index
- [ ] Free-tier: filter within 2-month window; premium: full history

> **Deferred to `16-mobile-capture-and-review.md`:** push notifications (SNS FCM/APNs, `POST /me/device-token`, device-token storage & pruning), the Flutter review screen, mobile feedback, mobile dashboard/pull-to-refresh, and the mobile tag-filter chip row.
