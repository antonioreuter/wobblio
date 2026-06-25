# 09 — Households

**Epic 7 | Phase 4 | Premium feature; depends on auth and ingestion**

## Overview

Household creation and management for Premium users (≤5 members), shared upload quota, per-member purchase attribution, and household-space invoice targeting.

## Dependencies

- [04 — Authentication & Waitlist](./04-authentication-waitlist.md)
- [07 — Core Ingestion Pipeline](./07-core-ingestion-pipeline.md)

## Business Rules

- **Create household:** Premium only. One household per user as owner at a time.
- **Join household:** STANDARD users can join (but not create). Accept invite link.
- **Household size:** ≤3 members (owner + 2).
- **Household upload pool:** 15 uploads/week (additive, draws only from household-space uploads), **active only once the household has more than one member** (owner + ≥1). A solo owner cannot draw from the pool and uploads from personal quota.
- **Pooling rule (critical):** upload targeted at household draws from household pool (15/week); upload targeted at personal space draws from personal quota. Neither borrows from the other.
- A household of 3 Premium members: 3×10 personal + 15 pooled = 45 theoretical weekly uploads.
- **Household data:** invoices uploaded into the household space have `tenant_id = household_id` (RLS scoped to household members).

## Invite Flow

1. Household owner generates invite link (`POST /households/{id}/invite`)
2. Invite token stored in `household_invite` (encrypted at rest per §7.5)
3. Recipient opens link → accept endpoint validates token → joins `household_member`
4. Owner can revoke invite tokens
5. Owner can remove members

## Quota Mechanics

`quota_counter` rows:
- Personal: `(user_id, UPLOADS, week_start)` — used by personal-space uploads
- Household: `(household_id, HOUSEHOLD_UPLOADS, week_start)` — used by household-space uploads

Weekly bucket: resets on Monday 00:00 UTC.

## Household-Space Invoices

- `invoice.household_id` set when uploading to household space
- `invoice.uploaded_by_user_id` tracks which member uploaded
- RLS policy: household members can read household-space invoices
- Per-member attribution in household reports (sum of invoices by `uploaded_by_user_id`)

---

## Checklist

### Data Model
- [ ] `household` table with `owner_user_id` FK
- [ ] `household_member` table with `(household_id, user_id)` primary key
- [ ] Household invite token storage (encrypted, with expiry)
- [ ] RLS policy on `invoice` to include household members when `household_id` is set

### Household Management Endpoints
- [ ] `POST /households` — create household (PREMIUM only); enforce max 1 owned household
- [ ] `GET /households/{id}` — get household details + member list
- [ ] `DELETE /households/{id}` — disband household (owner only); detach members
- [ ] `POST /households/{id}/invite` — generate invite link (owner only); encrypt token, store with expiry
- [ ] `POST /households/accept-invite/{token}` — join household; validate token, enforce max 3 members
- [ ] `DELETE /households/{id}/members/{user_id}` — remove member (owner only)
- [ ] `POST /households/{id}/leave` — leave household (non-owner members)

### Upload Quota Integration
- [ ] `POST /invoices/presign` accepts optional `household_id` parameter
- [ ] When `household_id` provided: check household quota (`HOUSEHOLD_UPLOADS` counter) instead of personal
- [ ] Increment the correct counter atomically on presign
- [ ] Refund correct counter on confirmed duplicate

### Web UI (Household Page)
- [ ] Member list with avatar, name, upload count this week
- [ ] Invite link generator with copy button
- [ ] Revoke invite button
- [ ] Remove member button (owner)
- [ ] Leave household button (non-owner)
- [ ] Household upload pool: progress bar showing XX/15 used this week (pool active only with ≥2 members)
- [ ] Disbanding household: confirmation modal + warning about shared data

### Mobile UI
- [ ] Household section in Profile tab
- [ ] Member list + invite flow
- [ ] Upload target selector: personal or household (shown at capture time for Premium household members)

### Household Reporting
- [ ] Per-member spend breakdown in household context (which member uploaded how much spend)
- [ ] Household-space invoices visible to all members in their invoices list
- [ ] Budget definitions can scope to `MEMBER` (per `budget.member_user_id`)
