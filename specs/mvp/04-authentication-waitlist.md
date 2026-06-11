# 04 — Authentication & Waitlist

**Epic 4 | Phase 2 | Blocks all user-facing features**

## Overview

Cognito-based authentication with Google and Meta (Facebook) social login federation. Four-role hierarchy enforced at the database level. Waitlist guardrail with atomic counter and paid bypass integration.

## Dependencies

- [02 — Infrastructure, Database & RLS](./02-infrastructure-database-rls.md)
- [05 — Billing & Stripe](./05-billing-stripe.md) (for waitlist bypass flow; can be implemented partially without billing)

## Role Hierarchy

| Role | Description | Escalation |
|---|---|---|
| `STANDARD` | Free users, core caps apply | Via Stripe webhook only |
| `PREMIUM` | Full feature suite, premium caps | Via Stripe webhook only |
| `TESTER` | Internal testing, caps from `limits` table | Via operator script only |
| `ADMIN` | Full access, admin console clearance | Via direct DB manipulation only |

**Critical:** The `role` column is **never writable by any application-exposed mutation**. Role changes happen only via the Stripe webhook handler (`STANDARD` ↔ `PREMIUM`) or operator scripts (`TESTER`, `ADMIN`).

## Quota Matrix

| Quota | STANDARD | PREMIUM | TESTER | ADMIN |
|---|---|---|---|---|
| Personal uploads/week | 3 | 10 | `limits` table | unlimited |
| Household membership | join only | create + join | `limits` table | unlimited |
| Household pooled uploads/week | — | 20 per household | `limits` table | unlimited |
| Active shopping lists | 3 | 10 | `limits` table | unlimited |
| Reporting depth | top-level categories, 2 months | full drill-down, full history | full | full |
| Products in comparison chart | — | 3 | `limits` table | unlimited |
| Budget definitions | — | 10 | `limits` table | unlimited |

**Pooling rule:** uploads to the household space draw from the 20/week household pool; uploads to personal space draw from personal quota. Neither borrows from the other.

## Waitlist Flow

1. Cognito pre-signup Lambda reads the atomic free-user counter row from `system_counter`
2. If count < `max_free_users_cap` (SSM): create account normally, increment counter atomically
3. If count ≥ cap: create Cognito account but set `STATUS_WAITLIST` in custom attributes and `app_user.status`
4. Waitlisted users: all functional endpoints return `423 Locked` with waitlist payload (position, CTA)
5. Client renders waitlist screen with "skip the line — go Premium" CTA
6. CTA → Stripe Checkout → `checkout.session.completed` webhook → flip to `PREMIUM`, clear `STATUS_WAITLIST`, unlock account (same transaction)
7. Admin raises cap → release job promotes waitlisted accounts FIFO, SES notification per release

**Atomic counter:** use a single `system_counter` row for free-user count — never a `COUNT(*)` scan. `UPDATE system_counter SET value = value + 1 WHERE name = 'free_users' RETURNING value` inside a transaction with `SERIALIZABLE` isolation (or advisory lock) to prevent race conditions.

## JWT Flow

- Cognito issues JWT on login
- API Gateway JWT authorizer validates tokens
- Lambda authorizer extracts `cognito_sub` → resolves `app_user` → sets `SET LOCAL app.current_tenant_id`

## Social Federation

- Google: standard OIDC federation via Cognito hosted UI
- Meta (Facebook): OAuth 2.0 federation via Cognito hosted UI
- Required scopes: email, profile
- Merging accounts with the same email: handled by Cognito's account linking

---

## Checklist

### Cognito Configuration
- [ ] User Pool with email as primary sign-in attribute
- [ ] Custom attributes: `custom:role`, `custom:status` (writable only by Lambda/backend)
- [ ] Google OIDC identity provider configured
- [ ] Meta (Facebook) OAuth 2.0 identity provider configured
- [ ] App client for Flutter mobile (no secret, PKCE flow)
- [ ] App client for Next.js web (with secret, authorization code flow)
- [ ] Hosted UI domain configured (for social login redirects)
- [ ] Token expiry: access token 1h, refresh token 30 days

### Pre-Signup Lambda
- [ ] Triggered on `PRE_SIGN_UP` Cognito event
- [ ] Reads atomic free-user count from `system_counter` (SELECT ... FOR UPDATE or advisory lock)
- [ ] If count < cap: approve, will increment counter in post-confirmation Lambda
- [ ] If count ≥ cap: approve (account still created), but flag for `STATUS_WAITLIST` in post-confirmation
- [ ] Does not block sign-up for paid (Premium bypass is handled in webhook flow)

### Post-Confirmation Lambda
- [ ] Creates `app_user` row: `role=STANDARD`, `status=ACTIVE` or `STATUS_WAITLIST`
- [ ] If `ACTIVE`: increments `system_counter` atomically
- [ ] If waitlisted: records waitlist position (order by `created_at`)

### API Gateway JWT Authorizer
- [ ] Validates Cognito JWT (JWK endpoint configured)
- [ ] Extracts `cognito_sub` from token
- [ ] Resolves `app_user` (cached per request, not per Lambda warm start)
- [ ] Sets `SET LOCAL app.current_tenant_id` before every query
- [ ] Returns `401` for expired/invalid token
- [ ] Returns `403` for valid token but `DELETED` account

### Waitlist Middleware
- [ ] All functional Lambda handlers check `app_user.status` at request start
- [ ] `STATUS_WAITLIST` → return `423 Locked` with payload: `{ position, total_waitlist, upgrade_url }`
- [ ] Waitlist position computed from `system_counter` total vs. cap (approximate, not exact rank query)

### Quota Enforcement
- [ ] `quota_counter` table read/write in a dedicated domain service
- [ ] Weekly bucket: `week_start` = Monday 00:00 UTC for `UPLOADS`, `HOUSEHOLD_UPLOADS`
- [ ] Enforce personal upload quota before presign URL generation
- [ ] Enforce household upload quota before presign URL for household-targeted uploads
- [ ] Enforce active shopping list limit before list creation
- [ ] Enforce budget definition limit before budget creation
- [ ] Tester/Admin quotas read from `limits` table, fallback to unlimited for ADMIN

### Waitlist Release Job
- [ ] EventBridge cron: run when admin raises `max_free_users_cap` (or nightly check)
- [ ] Promote waitlisted accounts in FIFO order (by `created_at`)
- [ ] Update `status = ACTIVE`, increment counter
- [ ] Send SES notification email to each released user

### Mobile Auth (Flutter)
- [ ] Cognito Amplify library integration
- [ ] Google Sign-In native flow (not hosted UI on mobile, for better UX)
- [ ] Meta login native SDK
- [ ] Secure token storage (Keychain iOS / Keystore Android)
- [ ] Token refresh on 401 response

### Web Auth (Next.js)
- [ ] NextAuth.js (or Amplify) with Cognito provider
- [ ] Server-side session management
- [ ] Middleware to protect authenticated routes
- [ ] Redirect to login on 401, to waitlist page on 423
