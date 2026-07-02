# 14c — Account Deletion, Phase 1 (Immediate Soft-Lock)

**Epic 14 | Parent: [14](../14-gdpr-data-lifecycle.md) · Tracker: [00-handoff](./00-handoff.md)**

Status: ⬜ not started

## Dependencies

- [09](../09-households.md) (household disband/detach — already fully built, reused as-is)
- Existing: `api-handler/index.ts`'s DELETED-status gate (`index.ts:106-109`) — this slice rewrites
  its behavior, so read it carefully before touching it; every route flows through this check.

## Key decision carried from the handoff (do not re-litigate)

Cognito `AdminDisableUser` is **deferred to Phase 2** ([14d](./14d-deletion-phase2.md)). The spec's
"sign in to cancel" is impossible if Cognito sign-in is disabled at Phase 1 — so Phase 1 stays
purely DB-level. See handoff decision #1 for the full rationale.

## Scope

### Migration
- `app_user.deletion_requested_at TIMESTAMPTZ NULL` — new column, needed to compute the 30-day grace
  window and to know when to auto-cancel vs. hard-403.

### `POST /me/delete` endpoint
- Sets `app_user.status = 'DELETED'`, `deletion_requested_at = now()`.
- Detaches the user from all households: if owner, `disband_household` (reuse as-is); if member,
  `remove_household_member` (reuse as-is).
- Sends the 30-day grace SES email ("scheduled for deletion in 30 days, sign in to cancel").
- Does **not** touch Cognito.

### Auto-cancel rewrite of the DELETED gate

Replace the current unconditional 403 (`api-handler/index.ts:106-109`) with:
- `status === 'DELETED'` AND `deletion_requested_at` within 30 days → flip `status` back to
  `'ACTIVE'`, clear `deletion_requested_at`, log the auto-cancel, then let the request proceed
  through normal dispatch.
- `status === 'DELETED'` AND `deletion_requested_at` more than 30 days ago (Phase-2 cron hasn't
  caught up yet) → still hard 403, account is locked pending purge.

This is the highest-blast-radius part of the epic — it sits before every route's dispatch. Needs its
own careful test pass (a request during the grace window must reactivate *and* complete normally;
one past the window must 403 with no side effects).

## Out of scope (belongs to 14d)

- Cognito `AdminDisableUser`/`AdminDeleteUser`.
- Hard-deleting tenant-scoped tables.
- Payment transaction anonymization, deletion audit stub.

## Checklist

- [ ] Migration: `app_user.deletion_requested_at`
- [ ] `POST /me/delete` — status flip, household detach/disband (reused), grace email
- [ ] Auto-cancel rewrite of the DELETED gate in `api-handler/index.ts`
- [ ] SES grace-window email content
- [ ] UI: Settings "Delete my account" button + confirmation modal + 30-day notice (webapp, separate
      from this backend slice)
- [ ] Unit tests: household-owner delete disbands; household-member delete detaches only; auto-cancel
      within window reactivates + request proceeds; hard-403 past window, no side effects
- [ ] `skill:hexagonal-architecture-validator` exit 0
- [ ] `npm run test:unit` green
- [ ] `npm run validate:security` green (new column)

## Verification

- `POST /me/delete` as a household owner → household disbanded, other members' invoices revert to
  their own tenant space (unchanged), grace email sent.
- Sign back in within 30 days → account reactivated, request completes normally, no visible error.
- Sign in after 30 days (before the Phase-2 cron runs) → 403, account stays locked.
