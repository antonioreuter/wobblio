# 05a — Real Stripe Gateway, Webhook & Downgrade Path

**Parent:** [05 — Billing & Stripe](../05-billing-stripe.md) · **Priority: P1 (blocks launch;
invariant #5's role-flip mechanism does not actually exist)** · **Tag:** [DRIFT]
**DB migration:** none expected (payment_transaction/plan enums exist) · **validate:security:** run
anyway if any adapter SQL changes.

## Drift being fixed

`specs/mvp/README.md` marks Epic 05 "✅ Done". What actually shipped:

- The **only** gateway implementation is
  `Source/backend/src/infrastructure/adapters/billing/MockBillingGatewayAdapter.ts`. There is no
  Stripe SDK dependency, no live checkout, no webhook endpoint, and no webhook signature
  verification anywhere in `Source/backend` or `Source/webapp`.
- `BillingService.processWebhookEvent` (`core/services/billing/BillingService.ts:59-81`) handles
  only `checkout.session.completed` → `promoteToPremium`. **There is no downgrade**: a canceled or
  payment-failed subscription keeps PREMIUM forever. Invariant #5 promises `STANDARD ↔ PREMIUM`,
  bidirectional.
- Checkout is gated by an **SSM email whitelist** (`SsmBillingWhitelistAdapter`) that appears in no
  spec — a sensible soft-launch valve, but an undocumented product decision.
- The "webhook" path is exercised only via the mock's `autoCompleteEvent` (synchronous fake
  completion inside the checkout call).

The port design is sound (`IBillingGateway`, `IPaymentTransactionRepository`, `IBillingArchive`,
idempotent `upsertByStripeEventId`, raw-payload S3 archive). This spec is a drop-in adapter +
missing-event work, not a redesign.

## Scope

1. **`StripeBillingGatewayAdapter`** implementing `IBillingGateway` with the real Stripe SDK.
   Secrets from Secrets Manager (per spec 13), never env vars. Checkout session for
   MONTHLY/ANNUAL, `client_reference_id = userId`.
2. **Webhook endpoint** (new unauthenticated API route, signature-verified with the endpoint
   secret; reject on mismatch). Events: `checkout.session.completed` (promote — exists),
   `customer.subscription.deleted` and terminal `invoice.payment_failed` dunning outcome
   (**demote to STANDARD** — new `IAppUserRepository.demoteToStandard`, mirroring
   `promoteToPremium`; must not touch TESTER/ADMIN roles).
3. **Demotion side-effects:** none beyond the role flip — quota resolution already derives caps
   from role at read time (`UploadAllowanceResolver`), so no data migration.
4. **Whitelist decision:** either document it in 05 as the launch gate (recommended: keep until
   waitlist opens) or remove it. Record whichever in this spec's checklist when done.
5. **Local/dev:** keep `MockBillingGatewayAdapter` behind the existing factory pattern (mirrors
   `encryptionFactory` / `buildPushNotifier`); dev stage may run mock until Stripe test keys are
   provisioned.

## Explicitly out of scope

In-app purchase of any kind (invariant #4), pricing changes, proration logic, customer portal.

## Acceptance

- Stripe test-mode checkout completes → role PREMIUM; cancel subscription in test clock → role
  STANDARD; TESTER/ADMIN unaffected; every webhook idempotent via `stripe_event_id` upsert.
- Webhook with bad signature → 400, nothing written, payload not archived.
- README table row for 05 says "✅ (mock gateway)" until this ships — see Fix 02.
