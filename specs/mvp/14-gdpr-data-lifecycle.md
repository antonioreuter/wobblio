# 14 — GDPR & Data Lifecycle

**Epic 13 | Phase 5 | Must complete before public launch**

## Overview

GDPR compliance: consent capture at signup, data export (Art. 20), account erasure (Art. 17), retention schedules, and processor inventory. The export and deletion workflows are asynchronous and scalable.

## Dependencies

- [02 — Infrastructure, Database & RLS](./02-infrastructure-database-rls.md)
- [04 — Authentication & Waitlist](./04-authentication-waitlist.md)
- [05 — Billing & Stripe](./05-billing-stripe.md) (payment records retention)
- [08 — Data Intelligence Layer](./08-data-intelligence-layer.md) (de-identification boundary for price store)

## Key Boundaries

- **Personal data** (under RLS, deletable): invoice, invoice_line, shopping_list, shopping_list_item, budget, bill_split, quota_counter, ingestion_ledger, invoice_feedback, data_request, household, household_member
- **De-identified data** (price_observation — not personal, not deletable): no tenant/user/invoice reference; region coarsened; day-granular date only; k≥3 read threshold. This is documented in the privacy policy.
- **Legally required retention**: `payment_transaction` rows retained 7 years under tax law even after account deletion; `user_id` replaced with opaque audit token on deletion.
- **Price contribution opt-out**: `app_user.price_contribution_optout` toggle (default false). Suppresses future observation emission; retroactive deletion is technically meaningless (rows have no user reference) and is not offered — stated in privacy policy.

## Consent

- Captured at signup: checkbox acknowledging privacy policy + terms of service
- Privacy policy text explicitly states:
  - Receipt images deleted after 18 months
  - Parsed data retained until account deletion
  - Anonymous price points (product, store, region, date only) contributed to the community index and not deleted on account erasure
  - Price contribution opt-out available in settings
- Processor inventory disclosed: AWS (compute, storage, email), Stripe (payments), Bedrock model providers (AI inference)

## Data Retention Schedule

| Data | Retention | Mechanism |
|---|---|---|
| Receipt images (S3) | 18 months from upload | S3 lifecycle rule on uploads bucket |
| Parsed invoice data | Until account deletion | Deleted in account purge job |
| Price observations | Indefinite (not personal data) | Never deleted; de-identified at creation |
| Export ZIPs | 7 days from generation | S3 lifecycle rule on exports bucket |
| Payment transactions | 7 years (tax law) | `user_id` replaced with opaque token on deletion |
| Cognito identity | Deleted at account purge | Cognito `AdminDeleteUser` call |

## Data Export (GDPR Art. 20 — Right to Data Portability)

### Flow

1. User requests export: `POST /me/export`
2. Creates `data_request(kind=EXPORT, status=PENDING)` row
3. Enqueues SQS message to export worker
4. Returns `202 Accepted` with `request_id`
5. Export worker:
   - Streams all tenant-scoped tables to JSON + CSV
   - Includes original receipt images still within 18-month retention
   - Bundles into ZIP: `{tenant_id}/{request_id}.zip`
   - Uploads to `s3://wobblio-exports-{env}/` (access-logged bucket)
   - Sets `data_request.status=COMPLETED`, records `export_s3_key` (KMS-encrypted)
   - Sends push notification (SNS) + email (SES) with download link
6. Download: `GET /me/export/{request_id}/download` returns presigned URL valid 7 days
7. S3 lifecycle rule deletes the ZIP after 7 days
8. Rate limit: one export request per tenant per 24 hours

### Export Contents

- `invoices.json` + `invoices.csv`
- `invoice_lines.json` + `invoice_lines.csv`
- `shopping_lists.json` + `shopping_lists.csv`
- `budgets.json` + `budgets.csv`
- `receipts/` folder with original images (within 18-month window)
- `account.json` (user profile, no role/status internals)

## Account Deletion (GDPR Art. 17 — Right to Erasure)

### Two-Phase Flow

**Phase 1 (immediate on request):**
- `POST /me/delete` — user requests deletion
- `app_user.status = DELETED`
- Cognito tokens revoked; sign-in disabled (`AdminDisableUser`)
- Account invisible in all queries
- Household memberships detached (member removed from households; if owner: household disbanded, members detached)
- Grace window: 30 days — user can cancel by signing in once during this period
- SES email: "Your account is scheduled for deletion in 30 days. Sign in to cancel."

**Phase 2 (after 30-day grace window):**
- Scheduled purge worker (EventBridge + SQS):
  - Hard-delete all tenant-scoped rows in RDS
  - Delete receipt images from S3 uploads bucket (if not already expired)
  - Delete Cognito identity (`AdminDeleteUser`)
  - Replace `user_id` in `payment_transaction` with opaque audit token (UUID, no reverse lookup)
  - Write deletion audit stub: `(hashed_identifier, deletion_requested_at, purged_at)` — proves erasure was performed

**What survives (by design, stated in privacy policy):**
- Anonymized price observations (never personal data)
- `payment_transaction` rows with `user_id` replaced by opaque audit token (7-year tax retention)
- Deletion audit stub (hashed identifier + timestamps)

---

## Checklist

### Consent Capture
- [ ] Signup flow: mandatory checkbox linking to privacy policy + terms of service
- [ ] `app_user.consented_at` timestamp stored on account creation
- [ ] Privacy policy page at `/privacy` — covers all data categories, retention schedules, processor inventory, de-identification explanation, price contribution opt-out explanation

### Price Contribution Opt-Out
- [ ] `app_user.price_contribution_optout` field (default false)
- [ ] Settings page: toggle "Contribute anonymous price points to the community index"
- [ ] Ingestion worker: check opt-out flag before emitting price observations
- [ ] On toggle-off: future observations suppressed (no retroactive deletion)

### Data Export
- [ ] `POST /me/export` endpoint (one request per 24h, enforced by `data_request` table)
- [ ] Export SQS queue + export worker Lambda
- [ ] Export worker: stream all tenant tables, bundle ZIP with images within 18-month window
- [ ] ZIP upload to `wobblio-exports-{env}/{tenant_id}/{request_id}.zip`
- [ ] `data_request.status = COMPLETED`, `export_s3_key` stored (KMS-encrypted)
- [ ] SNS push notification on completion
- [ ] SES email on completion with download instructions
- [ ] `GET /me/export/{request_id}/download` → presigned URL (7-day expiry)
- [ ] S3 lifecycle rule on exports bucket: delete ZIPs after 7 days
- [ ] UI: Settings page "Request my data" button + status indicator (pending/ready/expired)

### Account Deletion — Phase 1 (Immediate)
- [ ] `POST /me/delete` endpoint (authenticated)
- [ ] Set `app_user.status = DELETED`
- [ ] Cognito: `AdminDisableUser` (tokens remain valid for remaining TTL, then invalid)
- [ ] Detach from all households (remove from `household_member`)
- [ ] If owner: disband household (`household.status = DISBANDED`), remove all members
- [ ] Send SES email: 30-day grace notice + cancel-by-signing-in instruction
- [ ] UI: Settings page "Delete my account" button with confirmation modal + 30-day notice

### Account Deletion — Phase 2 (30-Day Purge)
- [ ] `deletion-purge` cron Lambda (runs daily, checks for `DELETED` accounts >30 days old)
- [ ] Hard-delete: all rows in tenant-scoped tables where `tenant_id = user_id`
- [ ] Delete S3 receipt images (if any remain within 18-month window)
- [ ] Cognito: `AdminDeleteUser`
- [ ] `payment_transaction`: replace `user_id` with opaque audit token (UUID, stored in deletion audit)
- [ ] Write deletion audit stub: `(hashed_user_id, cognito_sub_hash, requested_at, purged_at)`
- [ ] Cancel-window: if user signs in during 30-day window → clear `DELETED` status, cancel scheduled deletion

### Receipt Image Lifecycle
- [ ] S3 lifecycle rule on uploads bucket: expire objects after 18 months (548 days)
- [ ] Lifecycle rule documented and tested in staging

### Payment Transaction Retention
- [ ] `payment_transaction` rows excluded from tenant deletion purge
- [ ] On purge: `user_id` replaced with `deletion_audit.audit_token` (opaque UUID)
- [ ] 7-year retention: no lifecycle rule deletes `payment_transaction` rows (manual purge after 7 years)

### Processor Inventory (Privacy Policy)
- [ ] AWS: compute (Lambda), storage (S3, RDS), email (SES), push (SNS), AI (Bedrock)
- [ ] Stripe: payment processing
- [ ] Bedrock model providers: AI inference for receipt parsing (models listed by role, opaque IDs noted as subject to change via admin)
