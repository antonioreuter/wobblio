# Fix 01 — Hard-Invariant Text Amendments (CLAUDE.md)

**Priority: P1 (invariant hygiene — the invariant list is the project's constitution; three of its
twelve entries no longer describe the enforced reality, which makes every future audit start from
false premises).**
**Tag:** [CONTRADICTION] · **DB migration:** none · **Code change:** none (policy text only)

## Findings

1. **Invariant #5 ("Role column is never writable by client APIs … only the Stripe webhook and
   operator scripts flip it")** is contradicted by shipped, deliberate code:
   `Source/backend/src/handlers/api-handler/adminQuotaRoutes.ts:44-46` implements
   `PUT /admin/users/{id}/role` via the single-statement SECURITY DEFINER `admin_set_user_role`
   (migration `20260625113033_admin_set_user_role.ts`), audited as `role.change` with before/after.
   The code comment explicitly calls itself an "invariant #5 deviation" — the deviation was decided
   and audited, but CLAUDE.md was never amended.
   Additionally, the "Stripe webhook" that flips STANDARD↔PREMIUM does not exist: the only billing
   gateway is `MockBillingGatewayAdapter` (see Fix `specs/mvp/05-billing-stripe/05a`), and only the
   *upgrade* path is implemented (`BillingService.ts:78-80`); there is no downgrade.

2. **Invariant #6 ("Quotas are enforced in one domain service with the matrix in §2.4")** references
   the superseded invoice-count matrix. The shipped model is **credit (token)–based** per
   `specs/non-functional/02-weekly-usage-limits/` (charge-by-timing: presign checks, worker charges
   actual all-model tokens on success; system-fault quarantine doesn't charge). Enforcement still
   lives in one family (`core/services/quota/QuotaService.ts` + `UploadAllowanceResolver.ts`) — the
   *shape* of the invariant holds, the *matrix reference* is dead.

3. **Invariant #11 (GDPR two-phase deletion)** is currently **not implemented** — 14c/14d are ⬜ in
   `specs/mvp/14-gdpr-data-lifecycle/00-handoff.md`. The invariant should stand (it is the target),
   but CLAUDE.md's overall status line ("spec-complete, implementation starting…") hides that this
   invariant is aspirational while most others are enforced. See Fix 02 for the status-line rewrite.

## Proposed fix (scoped)

Amend `CLAUDE.md` invariant text only — no behavior change:

- **#5** → "Role column is never writable by ordinary client APIs. It is flipped only by: the
  billing webhook (`STANDARD ↔ PREMIUM` — currently the mock gateway, see spec 05a), operator
  scripts, and the **audited admin console endpoint** `PUT /admin/users/{id}/role`
  (SECURITY DEFINER `admin_set_user_role`, audit action `role.change`). Any new role-write path
  requires a spec amendment."
- **#6** → replace "matrix in §2.4" with "the credit-based model in
  `specs/non-functional/02-weekly-usage-limits/` (charge-by-timing; household pool additive)".
- **#11** → append "(deletion phases 14c/14d not yet implemented — export (14b) and retention
  lifecycles are live; treat deletion as the highest-priority open compliance item)". Remove the
  parenthetical once 14d ships.

## Out of scope

- Building the missing downgrade path (owned by spec 05a).
- Building 14c/14d (already spec'd in their epic directory).
