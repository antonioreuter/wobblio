---
type: Security Reference
title: GDPR Compliance & Data Lifecycle
description: Specifications for user consent, retention schedules, asynchronous ZIP export pipelines, and two-phase account deletion rules.
tags: [security, gdpr, compliance, deletion, data-export]
timestamp: 2026-06-30T23:01:00Z
---

# GDPR Compliance & Data Lifecycle

Wobblio strictly adheres to GDPR principles (such as minimization, portability, and erasure) using automated data lifecycles and architectural boundaries.

---

## 1. Consent Capture & Data Retention

* **Consent Capture:** During onboarding or profile updates (`PUT /me/profile`), explicit consent checkboxes capture the user's agreement to the Privacy Policy and price contribution options. Consent states are saved in `app_user` fields.
* **Retention Schedule:**
  - **Raw Receipt Images:** Deleted automatically from the S3 uploads bucket after **18 months** via an S3 lifecycle configuration rule. This limits the exposure of raw image data while allowing historical lookups.
  - **Structured Transactions:** Parsed invoice and line-item rows are retained indefinitely in RDS to power user dashboards and reports, until account deletion is requested.

---

## 2. Asynchronous Data Export (Art. 20)

Users have the right to download all personal records. Since compiling invoice images and database rows is resource-intensive, exports run asynchronously:

```
  POST /me/export ──► Insert data_request ──► Enqueue SQS Job
                                                     │
                                                     ▼
  User Notification ◄── Presigned URL (7d TTL) ◄── Zip Upload to S3 ◄── Export Worker
```

1. **Request:** User calls `POST /me/export`. The API handler inserts a `data_request` row (status: `PENDING`) and publishes a job to the export SQS queue. Only one export request is allowed per tenant per 24-hour window.
2. **Worker Processing:** A dedicated export worker Lambda consumes the message:
   - Queries the database for all rows matching the tenant's ID across RLS tables.
   - Converts the rows into CSV and JSON files.
   - Downloads all active receipt images owned by the tenant from S3.
   - Packs the files and images into a single ZIP archive.
3. **S3 Storage & Notification:**
   - The worker uploads the ZIP to `s3://wobblio-exports-{env}/{tenant_id}/{request_id}.zip`.
   - The export S3 bucket is access-logged and blocks all public read permissions.
   - Once uploaded, the worker marks the `data_request` as `COMPLETE` and triggers an SNS push notification/SES email.
4. **Download:** The user requests the download URL, and the API returns an S3 presigned GET URL valid for **7 days**. An S3 lifecycle policy automatically deletes the ZIP object after 7 days.

---

## 3. Two-Phase Account Deletion (Art. 17)

To prevent accidental data loss or subscription recovery issues, account deletion executes in two phases:

```
  User Deletion Request ──► Phase 1: Soft-Lock (30 Days)
                                   │
                                   ▼ Grace Window Expires
                            Phase 2: Hard Purge (Permanent)
```

### Phase 1: Soft-Lock (Grace Window)
* Triggered immediately upon user request (`DELETE /me/profile`).
* **Actions:**
  - The `app_user.status` is set to `DELETED`.
  - Cognito access tokens are revoked, and logins are disabled.
  - The account data is hidden from all application-facing endpoints.
  - Any active household memberships are detached.
* **Grace Window:** The user has a **30-day grace window** to cancel the deletion by contact/support sign-in (re-enabling their account).

### Phase 2: Hard Purge
* A daily cron Lambda (`cron-purge-deleted-accounts`) queries for accounts whose deletion requests are older than 30 days.
* **Actions:**
  - Cascades delete operations across all tenant-scoped database rows (`invoice`, `invoice_line`, `shopping_list`, `budget`, `household`).
  - Deletes all associated receipt image objects from S3.
  - Purges the user identity from AWS Cognito User Pools.
  - Deletes the account profile row, leaving only a single hashed stub (user hash + timestamp) to prove the erasure occurred for compliance audits.

---

## 4. Preservation of Non-PII Assets

Certain records must survive account deletion for system integrity:
1. **Price Observations:** Anonymized price observations are RLS-exempt and contain no link to the user, household, or invoice (§6.5). These rows persist in the `price_observation` store to preserve the regional price index. Users can toggle off price contributions to stop new emissions, but old anonymized observations cannot be deleted as they are not linkable.
2. **Payment Transactions:** To comply with tax audit regulations, payment history in `payment_transaction` must be retained for **7 years**. During Phase 2, the user references (`user_id`) in these rows are overwritten with an opaque, randomized audit token. This strips the PII connection while keeping financial audit trails intact.
3. **Presigned URL Safety:** As a defense-in-depth policy, S3 presigned URLs generated for receipt images have a hard limit of **300 seconds (5 minutes)**, reducing the lifespan of exposed links. EXIF metadata is stripped client-side before any upload occurs.
