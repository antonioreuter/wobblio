# 14-00 — GDPR & Data Lifecycle Epic Handoff (living tracker)

**Epic 13 | Phase 5 | Parent: [14 — GDPR & Data Lifecycle](../14-gdpr-data-lifecycle.md)**

The flat parent spec covers consent, export, two-phase deletion, retention, and processor
disclosure in one file. It's split into independently shippable slices below. This file is the
**living tracker**: update the status column as each slice lands. The parent `14-*.md` remains the
requirements source of truth; the lettered sub-specs are implementation-ready slices in build order.

> **Workflow:** implement **one slice at a time**, update this tracker + the slice's checklist,
> then clear context between slices where practical.

## Slices

| Slice | Title | Status | Depends on |
|---|---|---|---|
| [14a](./14a-consent-price-optout.md) | Consent capture & price-contribution opt-out | ✅ | — |
| [14b](./14b-data-export.md) | Data export (Art. 20) | ✅ | — |
| [14c](./14c-deletion-phase1.md) | Account deletion — Phase 1 (soft-lock + grace) | ⬜ | — |
| [14d](./14d-deletion-phase2.md) | Account deletion — Phase 2 (30-day hard purge) | ⬜ | 14c |
| [14e](./14e-processor-inventory-privacy-policy.md) | Processor inventory & privacy policy page | ⬜ | 14a–14d (content-complete once those ship) |

Status legend: ⬜ not started · 🚧 in progress · ✅ done

**Dependency DAG:** `14a` and `14b` are independent of each other and of deletion. `14c → 14d`
(Phase 2's purge query needs Phase 1's `deletion_requested_at` column and proven auto-cancel
semantics). `14e` is mostly webapp copy, cheapest done last once every other slice's behavior is
final and truthfully describable.

## Already-shipped groundwork found during exploration (not reflected in the parent spec's checklist)

- **Receipt image 18-month lifecycle rule**: already live on the uploads bucket
  (`gdpr-18-month-delete`, `Duration.days(548)`, `Source/infra/src/cdk/stacks/WobblioStorageStack.ts`).
- **Export ZIP 7-day lifecycle rule**: already live on the exports bucket (`gdpr-export-7-day-delete`,
  `Duration.days(7)`, same file), bucket already KMS-encrypted and already granted `grantReadWrite`
  to the api-handler — before this epic touched any code.
- **`data_request` table**: already exists verbatim (id, tenant_id, kind EXPORT|DELETION, status
  PENDING|PROCESSING|COMPLETED|FAILED, export_s3_key, requested_at, completed_at), RLS-enabled, in
  the initial schema migration. No backend code referenced it before 14b.
- **`app_user.gdpr_consent_at`** and **`app_user.price_contribution_optout`**: both already exist and
  are already wired — consent is stamped by `complete_user_onboarding`; the opt-out flag is already
  read at the price-observation emission gate (`core/domain/priceObservation.ts`). 14a only had to
  add the *write* path for the toggle.
- **Household disband/detach**: fully built (`disband_household`, `remove_household_member` SQL
  functions + `HouseholdService`) — 14c's Phase 1 will reuse this as-is, not rebuild it.
- **`payment_transaction.user_id` is already nullable**, `price_observation` already has no tenant
  reference — both already shaped for the deletion/anonymization story 14d needs.

## Key decisions (apply across the whole epic, don't re-litigate per slice)

1. **Cancel-deletion flow (14c):** Cognito `AdminDisableUser` is deferred to Phase 2 (14d), not
   called in Phase 1 — the spec's "sign in to cancel" is impossible if sign-in is disabled at
   Phase 1. Phase 1 only sets `app_user.status='DELETED'` + a new `deletion_requested_at`. The
   existing hard 403 for DELETED users at the top of `api-handler/index.ts` gains an auto-cancel
   branch: within the 30-day window, the next successful authenticated request flips status back to
   `ACTIVE` and clears `deletion_requested_at`, then proceeds; past the window it stays 403'd
   (awaiting the Phase 2 purge cron).
2. **Export URL TTL (14b):** No new long-TTL presign method, no invariant #10 exception. Every
   `GET /me/export/{id}/download` call mints a fresh 300s presigned URL via the existing
   `S3FileStorageAdapter.presignGet` (unchanged). The completion email/push never carries a raw URL.
3. **Purge FK strategy (14d):** No `ON DELETE CASCADE` added to existing FKs on tenant-scoped tables.
   A new thin `purge_account_data(user_id)` SECURITY DEFINER SQL function does explicit
   child-to-parent deletes, matching the `disband_household` convention. `price_observation` and
   `payment_transaction` are never touched by it (payment anonymization is a separate statement).
4. **Export key encryption (14b):** `data_request.export_s3_key` is stored plaintext — bucket-level
   SSE-KMS on the exports bucket is sufficient (matches the `invoice.image_s3_key` precedent); the
   key alone isn't a bearer credential given decision #2 already killed static long-lived links.
5. **Rate-limit on failure (14b):** Only `PENDING`/`PROCESSING`/`COMPLETED` rows in the last 24h
   count toward the 1-export/24h limit; a `FAILED` row doesn't block same-day retry.
6. **New `gdpr` family**: `core/services/gdpr/`, `core/ports/gdpr/`, `infrastructure/adapters/gdpr/`
   is the home for export + deletion service logic (a genuinely new capability area per
   `Source/backend/CLAUDE.md`'s mirrored-family convention). The Cognito admin port (14d) also lives
   under this family unless a broader identity need for it emerges later.

## 14a — done

Consent capture and the opt-out flag already existed; the only gap was a write path. Added
`IAppUserRepository.setPriceContributionOptout` + `AppUserRepositoryAdapter` raw-SQL implementation
(mirrors `promoteToPremium`'s narrow single-purpose convention) + `PUT /me/price-contribution-optout`
route in `handleMeRoute`. No migration, no new service class (single UPDATE, Rule of Three/YAGNI).

## 14b — done

Full async export flow: `POST /me/export` → SQS → `export-worker` Lambda builds a ZIP (JSON+CSV per
table + `receipts/`) → uploads to the exports bucket → `GET /me/export/latest` for status polling →
`GET /me/export/{id}/download` mints a fresh 300s URL per call. New `gdpr` family end to end. See
[14b-data-export.md](./14b-data-export.md) for the full checklist and file list.

## Settings-page UI (webapp) — done 2026-07-03

14a and 14b were backend-only until this pass. The webapp Settings page
(`Source/webapp/src/app/(app)/settings/page.tsx`, previously a `ComingSoon` stub) now ships:

- The 14a opt-out toggle ("Contribute anonymous price points…"), wired to
  `PUT /me/price-contribution-optout`. Required one small additive backend fix alongside it:
  `GET /me/profile` didn't return `price_contribution_optout`, so the toggle had no current state to
  render — added via a new migration extending `get_user_profile()`, plus the matching
  `OnboardingProfile`/`AppUserRepositoryAdapter` change.
- The 14b export flow ("Request my data" → status polling → "Download your data"), wired to
  `POST /me/export`, `GET /me/export/latest`, `GET /me/export/{id}/download`.

**14c/14d (account deletion) remain fully unbuilt** — no `POST /me/delete` endpoint, no soft-lock,
no purge cron. The Settings page only ships a visibly disabled "Delete my account" placeholder card
with no backend call behind it. Don't treat the Settings page's existence as evidence deletion is
implemented.

## 14c / 14d / 14e — not started

Sub-spec files below carry the relevant checklist items forward from the parent spec, decomposed by
phase, with the key decisions above already folded in. Pick up 14c next; 14d cannot start
meaningfully before it. 14e's remaining scope is narrower than originally scoped — see its file.
