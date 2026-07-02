# 14a — Consent Capture & Price-Contribution Opt-Out

**Epic 14 | Parent: [14](../14-gdpr-data-lifecycle.md) · Tracker: [00-handoff](./00-handoff.md)**

Status: ✅ done

## Scope

Consent capture and the price-contribution opt-out *flag* already existed before this slice:

- `app_user.gdpr_consent_at` (this is the spec's `consented_at`, named differently) is stamped by
  `complete_user_onboarding` (`Source/infra/src/migrations/20260614180000_user_onboarding.ts`) at
  signup onboarding, gated on the mandatory consent checkbox already enforced client-side +
  server-side (`ProfileService`'s `validate()` throws `InvalidProfileError` if `!input.consent`).
- `app_user.price_contribution_optout` (default `false`) already exists in the initial schema and is
  already read at the price-observation emission gate (`core/domain/priceObservation.ts:84` —
  `if (input.context.optedOut || ...) return []`), threaded through `InvoiceLocationService`,
  `InvoiceFinalizer`, `HeldInvoiceReleaseService`.

The only real gap: no endpoint let a signed-up user flip the opt-out **after** onboarding.

## What was built

- `IAppUserRepository.setPriceContributionOptout(userId, optout): Promise<void>` — new port method.
- `AppUserRepositoryAdapter`: raw `UPDATE app_user SET price_contribution_optout = $2 WHERE id = $1`
  — mirrors `promoteToPremium`'s narrow, single-purpose raw-SQL convention (no generic "update user").
- `PUT /me/price-contribution-optout` in `handleMeRoute` (`api-handler/index.ts`), body
  `{ optout: boolean }`, wrapped in `withTenantTx`, `204` on success, `400` on a non-boolean body.
- No migration (both DB fields pre-existed). No new service class — a single UPDATE doesn't warrant
  one (Rule of Three / YAGNI); the route calls the adapter directly, same shape as
  `handleRegisterDeviceToken`'s directness.

## Out of scope (belongs to 14e)

- `/privacy` page copy, the settings-page toggle UI, processor inventory disclosure text.

## Checklist

- [x] `IAppUserRepository.setPriceContributionOptout` port method
- [x] `AppUserRepositoryAdapter` raw-SQL implementation
- [x] `PUT /me/price-contribution-optout` route, `withTenantTx`-wrapped
- [x] `skill:hexagonal-architecture-validator` exit 0
- [x] `npm run test:unit` green

## Verification

- `PUT /me/price-contribution-optout { optout: true }` → `204`, `app_user.price_contribution_optout`
  flips to `true` for that tenant only (RLS-scoped).
- A subsequent invoice's price-observation emission is suppressed (existing `optedOut` gate, already
  covered by prior tests — this slice adds no new emission-path test, only the write path).
