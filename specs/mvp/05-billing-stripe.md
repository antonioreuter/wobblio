# 05 — Billing & Stripe

**Epic 12 | Phase 2 | Required for revenue, waitlist bypass, and Premium features**

## Overview

Stripe Checkout for subscriptions (web-only, no in-app purchase), customer portal for self-service management, webhook-driven role transitions, EU VAT handling, and full payment transaction persistence for audit and analytics.

## Dependencies

- [02 — Infrastructure, Database & RLS](./02-infrastructure-database-rls.md)
- [04 — Authentication & Waitlist](./04-authentication-waitlist.md)

## Pricing

| Plan | Price | Notes |
|---|---|---|
| Monthly | €2.50/month | Available but not promoted |
| Annual | €25/year | **Promoted default** — "2 months free"; one fixed Stripe fee/year vs. 12 |

**Sales channel rule (binding):** subscriptions sold **only** via Stripe Checkout on web. Mobile apps deep-link to web upgrade page where store rules allow; otherwise show neutral "manage your plan on the web" screen. Never present in-app purchase — 15–30% store commission would consume the entire margin at this price point.

## Stripe Checkout Flow

1. Client calls `POST /billing/checkout-session` with `plan=MONTHLY|ANNUAL`
2. Lambda creates Stripe Checkout Session with pre-filled email, success/cancel URLs, `metadata.user_id`
3. Client redirects to Stripe-hosted checkout
4. `checkout.session.completed` webhook → Lambda verifies Stripe signature → transitions user to `PREMIUM`, creates/updates `stripe_customer_id`, clears `STATUS_WAITLIST` if applicable
5. Redirect to success page

## Webhook Events Handled

| Event | Action |
|---|---|
| `checkout.session.completed` | Set role `PREMIUM`, store `stripe_customer_id`, clear waitlist status |
| `customer.subscription.updated` | Sync plan (MONTHLY/ANNUAL), handle trial/active state |
| `customer.subscription.deleted` | Set role `STANDARD` (7-day grace state on cancellation — keep PREMIUM until period end) |
| `invoice.payment_failed` | Enter `PAYMENT_FAILED` grace state; 7-day window before downgrade |
| `invoice.payment_succeeded` | Clear grace state, confirm PREMIUM active |

## Payment Transaction Persistence (Idempotency)

Every webhook event:
1. Verify Stripe signature (reject invalid)
2. Archive raw JSON payload to `s3://wobblio-billing-archive-{env}/yyyy/mm/{event_id}.json`
3. Upsert normalized row into `payment_transaction` keyed on `stripe_event_id` (unique key makes redelivery idempotent)

`payment_transaction` schema:
```sql
(id, user_id, stripe_event_id UNIQUE, type ENUM(SUBSCRIPTION_CREATED, RENEWAL,
 CANCELLATION, PAYMENT_SUCCEEDED, PAYMENT_FAILED, REFUND),
 amount, currency, plan ENUM(MONTHLY,ANNUAL), occurred_at, raw_payload_s3_key)
```

Tax-relevant records retained 7 years irrespective of account deletion.

## Stripe Customer Portal

Self-service for: plan upgrade/downgrade, annual ↔ monthly switch, payment method update, subscription cancellation. Wobblio does not build a billing UI — Stripe's portal is the portal.

## EU VAT

Handled via Stripe Tax (enabled on Checkout Session). Stripe collects and remits EU VAT. Financial model assumes 21% blended EU VAT out of gross revenue.

## Grace State on Payment Failure

1. `invoice.payment_failed` → set `status=PAYMENT_GRACE`, keep `role=PREMIUM`
2. Stripe retries payment per its configured schedule
3. If payment recovered: `invoice.payment_succeeded` → clear grace state
4. After 7 days without recovery: `customer.subscription.deleted` fires → set `role=STANDARD`

---

## Checklist

### Stripe Configuration
- [ ] Create Stripe products and prices: Monthly (€2.50/month, EUR) and Annual (€25/year, EUR)
- [ ] Configure Stripe Tax for EU VAT handling
- [ ] Configure Customer Portal (allowed operations: update card, cancel, change plan)
- [ ] Webhook endpoint registered in Stripe dashboard for each environment
- [ ] Stripe webhook secret stored in Secrets Manager per environment
- [ ] Stripe publishable key + secret key stored in Secrets Manager per environment

### Checkout Session Endpoint (`POST /billing/checkout-session`)
- [ ] Requires authenticated user (JWT middleware)
- [ ] Creates or retrieves Stripe Customer for `app_user.stripe_customer_id`
- [ ] Creates Checkout Session: mode=subscription, price ID from SSM, metadata `{user_id}`, success/cancel URLs
- [ ] Returns `{ checkoutUrl }` for client redirect
- [ ] Waitlisted users can access this endpoint (bypass flow)

### Customer Portal Endpoint (`POST /billing/portal-session`)
- [ ] Requires `PREMIUM` role
- [ ] Creates Stripe Billing Portal Session for the user's `stripe_customer_id`
- [ ] Returns `{ portalUrl }` for client redirect

### Webhook Handler Lambda
- [ ] Verifies Stripe-Signature header using webhook secret from Secrets Manager
- [ ] Archives raw event JSON to S3 billing archive bucket (key: `{yyyy}/{mm}/{event.id}.json`)
- [ ] Upserts `payment_transaction` row keyed on `stripe_event_id`
- [ ] Routes to event-specific handlers:
  - [ ] `checkout.session.completed`: set `role=PREMIUM`, update `stripe_customer_id`, clear `STATUS_WAITLIST`
  - [ ] `customer.subscription.updated`: sync plan type
  - [ ] `customer.subscription.deleted`: set `role=STANDARD` after period end
  - [ ] `invoice.payment_failed`: enter grace state
  - [ ] `invoice.payment_succeeded`: clear grace state
- [ ] All role changes within a single DB transaction
- [ ] Returns `200` immediately after signature verification; processing is synchronous but fast
- [ ] Webhook Lambda alarm (Epic 14): errors > 0 → ops SNS topic

### Mobile Deep-Link Flow
- [ ] Flutter: detect `STANDARD` role trying to access premium feature
- [ ] Render in-app upgrade screen with deep-link button to web upgrade page
- [ ] Where store rules allow: button opens `{web_app_url}/upgrade` in external browser
- [ ] Where store rules don't allow: show neutral "manage your plan at {web_app_url}" notice
- [ ] No `StoreKit` / `BillingClient` dependencies anywhere in mobile codebase

### Web Upgrade Flow
- [ ] Pricing page at `/upgrade` (accessible without login for landing page CTA)
- [ ] Pricing table: Annual visually pre-selected; show "2 months free" badge
- [ ] Upgrade button calls `POST /billing/checkout-session`
- [ ] Success page: confirms Premium activation, deep-links to dashboard
- [ ] Cancel page: returns to pricing with retry option
- [ ] Post-upgrade: session refresh to pick up new `PREMIUM` role

### Data Retention & Compliance
- [ ] `payment_transaction` rows: retained 7 years (bypass account deletion erasure)
- [ ] S3 billing archive lifecycle: Standard → Glacier IR at 90 days → 7-year retention
- [ ] On account deletion (Epic 13): replace `user_id` in `payment_transaction` with opaque audit token (not deleted)

### Analytics
- [ ] Glue table definition over `s3://wobblio-billing-archive-{env}` for Athena ad-hoc queries
- [ ] KPI feed: MRR, churn rate, conversion rate sourced from `payment_transaction` + `app_user.role` (Epic 15)
