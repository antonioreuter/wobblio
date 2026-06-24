# 12a — Admin Foundation

**Epic 10 | Phase 5 | Parent: [12 — Admin Console](./12-admin-console.md)**

Blocking foundation for the admin console: real session auth + role gate on the admin app, a
backend `/admin/*` route family with per-endpoint ADMIN enforcement, and an audit log for every
admin mutation. **12b–12f depend on this.**

## Dependencies

- [12 — Admin Console](./12-admin-console.md) (shared access-control rules)
- [04 — Authentication & Waitlist](./04-authentication-waitlist.md) (Cognito, `/me/profile`)
- [02 — Infrastructure, Database & RLS](./02-infrastructure-database-rls.md)

## Decision — admin app auth

Reuse the proven webapp pattern (`Source/webapp/src/auth.ts`): **NextAuth + Cognito**, JWT
session strategy, role sourced from the database via `GET /me/profile` at sign-in (never from
Cognito attributes — see memory `no-cognito-profile-attrs`). The admin app gets its own NextAuth
config mirroring the webapp's, including the local credentials provider for `:3001` dev.

`verifySessionJwt(cookie, secret)` in the spec stub resolves to **reading the NextAuth session**
in middleware (`auth()` helper), not a hand-rolled JWKS verifier. The middleware then calls the
existing `checkAdminRole(session.user.role)`.

## Backend

New admin route family in the existing single `api-handler` Lambda.

- In `Source/backend/src/handlers/api-handler/index.ts`: add `isAdminRoute = path.startsWith('/admin/')`
  and dispatch to a new `handleAdminRoute(...)`.
- New file `Source/backend/src/handlers/api-handler/adminRoutes.ts` — the admin dispatcher.
  **First line of every admin handler:** `if (user.role !== 'ADMIN') return json(403, ...)`
  (mirrors the role gate in `priceTrendRoutes.ts`). The page-level middleware is defense in
  depth, not the authority.
- 12a itself ships only the dispatcher + a `GET /admin/ping` smoke endpoint returning
  `{ ok: true }` for an ADMIN; the feature endpoints land in 12b–12f.

### Audit log

Every **mutating** admin endpoint records one row. New migration (node-pg-migrate via the
`database-migrations` skill): `admin_audit_log` (id, actor_user_id, action, target_type,
target_id, before JSONB, after JSONB, created_at). Globally readable, no RLS (operator table).

- Port `core/ports/admin/IAdminAuditLog.ts` — `record(entry)`.
- Service `core/services/admin/AdminAuditService.ts` — builds the entry; called by mutating
  handlers in later sub-specs.
- Adapter `infrastructure/adapters/admin/AdminAuditLogAdapter.ts` (pg).

## Frontend (`Source/admin/`)

- Add NextAuth config + `auth.ts` mirroring `Source/webapp/src/auth.ts` (Cognito provider,
  local credentials provider when `COGNITO_ENDPOINT` set, DB-sourced role).
- Replace the fail-secure stub in `src/middleware.ts` with: read session → `checkAdminRole` →
  redirect `/403` on failure. Keep the matcher excluding `/403`, `_next/*`, `favicon.ico`.
- `/login` page for the admin app (reuse webapp login shape).
- Admin API client helper that attaches the Cognito **ID token** as `Authorization: Bearer`
  (API Gateway authorizer expects the ID token — see memory `infra-gotchas`).

## Reuse references

- `Source/backend/src/handlers/api-handler/{index.ts,priceTrendRoutes.ts,shared.ts}` — route +
  role pattern, `json`, `withTenantTx`.
- `AppUserRepositoryAdapter`, `TenantContextAdapter`.
- `Source/webapp/src/auth.ts`; `Source/admin/src/lib/check-admin-role.ts`.

## Open decisions

- WAF/IP allowlist scope is deferred to **12g**.
- Audit-log retention/PII: store actor `user_id` only (opaque); no free-text PII in before/after.

## Checklist

- [ ] NextAuth + Cognito config in `Source/admin/`; DB-sourced role; local credentials provider
- [ ] `src/middleware.ts` reads session, gates via `checkAdminRole`, redirects `/403` (stub replaced)
- [ ] `/login` page for admin app
- [ ] `handleAdminRoute` dispatcher wired in `api-handler/index.ts`; `adminRoutes.ts` created
- [ ] Per-endpoint `role !== 'ADMIN' → 403` guard pattern established
- [ ] `GET /admin/ping` smoke endpoint
- [ ] `admin_audit_log` migration + port + service + adapter (no RLS, no PII)
- [ ] ADMIN role un-writable by any API — documented in RBAC notes
- [ ] Hexagonal validator exit 0; unit tests for `AdminAuditService` + role guard
- [ ] `npm run validate:security` green (new migration)

## Verification

- Unauthenticated / non-ADMIN session → `/403` (middleware) AND 403 from `GET /admin/ping`
  (backend), proving defense-in-depth.
- ADMIN session → `GET /admin/ping` returns `{ ok: true }`.
- A mutating call writes exactly one `admin_audit_log` row with correct before/after.
