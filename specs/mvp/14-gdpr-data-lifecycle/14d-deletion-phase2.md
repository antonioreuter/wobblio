# 14d — Account Deletion, Phase 2 (30-Day Hard Purge)

**Epic 14 | Parent: [14](../14-gdpr-data-lifecycle.md) · Tracker: [00-handoff](./00-handoff.md)**

Status: ⬜ not started · **Depends on [14c](./14c-deletion-phase1.md) shipping first**

The purge query (`status='DELETED' AND deletion_requested_at < now() - 30d`) is meaningless until
14c populates `deletion_requested_at` and the auto-cancel semantics are proven correct — do not
start this slice before 14c is done and verified.

## Dependencies

- [14c](./14c-deletion-phase1.md) (`app_user.deletion_requested_at`, `status='DELETED'` semantics)
- Existing: `cron-data-retention` (`{resource: string}`-dispatched Lambda + `makeCron` CDK helper) —
  reference for cron wiring shape, though this slice likely wants its own dedicated Lambda given the
  amount of new logic (Cognito calls, purge function, audit stub) rather than folding into that
  generic dispatcher.
- `@aws-sdk/client-cognito-identity-provider` — already an installed, unused dependency.

## Key decision carried from the handoff (do not re-litigate)

No `ON DELETE CASCADE` added to existing tenant-scoped FKs. A new thin `purge_account_data(user_id)`
SECURITY DEFINER function does explicit child-to-parent deletes, matching the `disband_household`
convention (handoff decision #3).

## Scope

### New `ICognitoIdentityManager` port (greenfield — nothing like this exists yet)
- `core/ports/gdpr/ICognitoIdentityManager.ts` (or `identity/` if a broader need emerges):
  `disableUser(cognitoSub)`, `deleteUser(cognitoSub)`.
- `infrastructure/adapters/gdpr/CognitoIdentityManagerAdapter.ts` — wraps
  `AdminDisableUserCommand`/`AdminDeleteUserCommand` from the already-installed SDK.

### `purge_account_data(p_user_id UUID)` SQL function
- New migration, SECURITY DEFINER, thin, single-purpose (mirrors `disband_household`).
- Explicit child-to-parent `DELETE` order across all personal-data tables (§ Key Boundaries in the
  parent spec): `bill_split_line` → `bill_split` → `invoice_feedback` → `invoice_line` → `invoice` →
  `shopping_list_item` → `shopping_list` → `budget` → `quota_counter` → `ingestion_ledger` →
  `data_request` → `device_token`/`invoice_telemetry` (already CASCADE, but harmless to include
  explicitly for clarity) → `household`/`household_member` (should already be empty via 14c's
  detach/disband, but don't assume — verify and delete defensively) → `app_user`.
- `price_observation` and `payment_transaction`: **never touched** by this function.

### `deletion-purge` cron Lambda
- Dedicated Lambda (not folded into `cron-data-retention`'s generic dispatcher, given the amount of
  distinct logic here), daily schedule.
- Query: `app_user` where `status='DELETED' AND deletion_requested_at < now() - interval '30 days'`.
- Per matched user: `purge_account_data(user_id)` → delete S3 receipt images (if any remain within
  the 18-month window) → `AdminDisableUser` + `AdminDeleteUser` (both happen here, not in 14c) →
  anonymize `payment_transaction` (`user_id` → opaque audit token UUID) → write deletion audit stub.

### `deletion_audit` table (new)
- `hashed_user_id`, `cognito_sub_hash`, `requested_at`, `purged_at` — proves erasure was performed
  without retaining a reversible identifier. No RLS (nothing to scope — the account is gone).

### Payment transaction anonymization
- Single `UPDATE payment_transaction SET user_id = <new opaque UUID> WHERE user_id = $1` — the
  7-year tax retention already assumes `user_id` is nullable/replaceable (schema already supports
  this; no DDL change needed here beyond the new audit table).

## Checklist

- [ ] `ICognitoIdentityManager` port + adapter (new capability, no prior art in the codebase)
- [ ] `purge_account_data(user_id)` migration — explicit ordered deletes, SECURITY DEFINER
- [ ] `deletion_audit` table migration
- [ ] `deletion-purge` cron Lambda — daily, queries `app_user`, orchestrates the full purge sequence
- [ ] S3 receipt image deletion for any images still within the 18-month window
- [ ] `payment_transaction` anonymization (opaque audit token)
- [ ] Deletion audit stub write
- [ ] `skill:hexagonal-architecture-validator` exit 0
- [ ] `npm run test:unit` green (mocked Cognito port, mocked purge repo)
- [ ] `npm run validate:security` green (new table + new SQL function)
- [ ] `cdk synth` + cdk-nag clean (new Lambda, new IAM for Cognito admin actions — least privilege,
      scoped to the one user pool, not `cognito-idp:*`)

## Verification

- Seed a `DELETED` account with `deletion_requested_at` 31 days ago → cron picks it up → all
  personal-data tables empty for that tenant, S3 images gone, Cognito identity gone,
  `payment_transaction.user_id` replaced with an opaque token, `deletion_audit` row written.
- `price_observation` rows the deleted user contributed remain untouched (already had no tenant ref).
- A `DELETED` account still within the 30-day window is **not** touched by this cron.
