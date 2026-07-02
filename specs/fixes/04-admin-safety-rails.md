# Fix 04 — [ADMIN] Safety Rails on Mutating Admin Actions

**Priority: P3 (all mutating admin actions are audited — verified — but several high-blast-radius
ones are one click, none are undoable in-UI, and admin sessions have no MFA)** ·
**Tag:** [GAP] [ADMIN] · **DB migration:** none.

Verified baseline (good): every mutation writes `admin_audit_log` with before/after (role change,
SSM edit, model swap, DLQ replay/delete, curation decisions, waitlist release, fault reprocess,
debug-sample egress). Role changes go through a single-statement SECURITY DEFINER. The gaps are
confirmation, reversal, and visibility:

## A. Typed confirmation on the three highest-blast-radius actions

- `POST /admin/dlq/replay-all` and `DELETE /admin/dlq/delete-all` — bulk, irreversible
  (delete-all destroys the only copy of failed ingestions). Require typing the queue name.
- Model matrix swap — a wrong model id bricks the pipeline **all-or-nothing** (known landmine:
  the api-handler IAM list is hardcoded per role; an unlisted model 403s everything; `pdf_parser`
  has no fallback and the worker dies at init if unset). Confirmation must display the IAM-list
  check result *before* accepting the swap — i.e. validate the model id against the role's allowed
  list server-side and warn on mismatch, don't discover it in production.

## B. One-click revert where the audit log already holds the previous value

Model swaps and SSM config edits record before/after. Add "revert to previous" on the swap-history
and config-history rows (writes a normal audited change with `before`/`after` reversed). This is
the cheapest possible undo and covers the two most frequently fat-fingered surfaces.

## C. Audit-log browser panel

The log is written everywhere and readable nowhere (only the model-swap history filters it).
Add a read-only `(console)/audit` page: filter by actor, action, date; this is also the incident
post-mortem tool. No new backend beyond a paged `GET /admin/audit`.

## D. Admin session hardening

MFA is `OPTIONAL` pool-wide and the admin app never demands it — owned by
`specs/mvp/13-security-controls/13a-posture-realignment-and-hardening.md` §C2; listed here because
it is the safety rail *under* all the others (every rail above assumes the actor is the admin).

## E. Role-change friction

`PUT /admin/users/{id}/role` is audited but instant. Add: mandatory free-text reason persisted to
the audit row, and block self-demotion of the last remaining ADMIN (lockout guard — today an admin
can demote themselves to STANDARD and orphan the console).

## Explicit non-goals

No approval workflows / four-eyes (team of ~1 operator; friction must stay proportionate), no
change to the never-client-writable role invariant (Fix 01 amends its *text* to match the audited
console path).
