# 00 — Access Control, Routing & Audit

**Epic 10 | Phase 5 | Admin Console foundation — blocks all other admin sub-specs**

## Overview

Everything else in the admin console depends on three primitives delivered here:

1. **Edge auth** — `verifySessionJwt` wired into the admin app middleware so only `ADMIN` users reach
   any page.
2. **Server-side auth** — a reusable admin guard re-checked on every `/admin/*` backend endpoint
   (middleware alone is not trusted).
3. **Audit log** — one table + one writer that every admin mutation records to.

Parent: [12 — Admin Console](../12-admin-console.md). This sub-spec replaces the fail-secure middleware
stub (`Source/admin/src/middleware.ts`) with real verification and establishes the admin route module
in the backend.

## Dependencies

- [02 — Infrastructure, Database & RLS](../02-infrastructure-database-rls.md) (audit table migration)
- [04 — Authentication & Waitlist](../04-authentication-waitlist.md) (Cognito User Pool, `custom:role` claim)

## Edge auth — `verifySessionJwt`

Implement `Source/admin/src/lib/verify-session-jwt.ts`:

- Input: the session cookie value + the Cognito config (User Pool ID / JWKS URI / app client ID).
- Validate the JWT signature against the User Pool **JWKS endpoint**, check `exp`/`iss`/`aud`.
- Extract the `custom:role` claim; return `{ role, sub, email }` or `null` on any failure.
- **Never** read role from a plain cookie field — spoofable (critical finding 2026-06-11).

Wire it into `Source/admin/src/middleware.ts`, replacing the unconditional redirect:

```ts
const session = await verifySessionJwt(request.cookies.get('session')?.value, cognitoConfig)
if (!session || !checkAdminRole(session.role)) {
  return NextResponse.redirect(new URL('/403', request.url))
}
return NextResponse.next()
```

`checkAdminRole` already exists and is tested (`Source/admin/src/lib/check-admin-role.ts`). The
matcher already excludes `/403` and static assets — keep it.

## Server-side auth — admin guard + route module

The backend is a single `api-handler` Lambda with per-feature route modules
(`Source/backend/src/handlers/api-handler/*Routes.ts`) dispatched from `index.ts`. Add admin the same way:

- New module `adminRoutes.ts` exporting `handleAdminRoute(client, user, path, method, event, log)`.
- Register in `index.ts`: `const isAdminRoute = path.startsWith('/admin/')` → `handleAdminRoute(...)`.
- **First line of the admin handler is the guard:** if `user.role !== 'ADMIN'` return `json(403, …)`.
  This is independent of the edge middleware — both must pass.
- Reuse `json`, `parseJsonBody`, `withTenantTx` from `shared.ts`. Admin reads of global tables
  (catalog, kpi_daily, SSM) do not need a tenant context; per-tenant reads still set it.
- Sub-routes (`/admin/config`, `/admin/models`, `/admin/waitlist`, `/admin/dlq`, `/admin/curation`,
  `/admin/ai-spend`, `/admin/kpis`) are added by sub-specs `02`–`08`, each as a small dispatch branch
  in `adminRoutes.ts`.

`role` remains non-writable by any API (root invariant #5) — the admin handler must never expose a
mutation of `app_user.role`.

## Audit log

One append-only table, written on every admin mutation across all sub-specs.

- Table `admin_audit_log`: `id`, `actor_user_id`, `actor_email`, `action` (e.g. `ssm.update`,
  `model.swap`, `dlq.replay`, `curation.approve`, `waitlist.release`), `target` (param name / message id
  / entity id), `before` / `after` (JSONB, nullable), `created_at`.
- Globally readable (no RLS — it is an operator table), written only from the admin handler.
- Port `IAdminAuditLog.record(entry)` in `core/ports/identity/` (or a new `admin/` family), adapter in
  `infrastructure/adapters/`. Core services call the port; the handler never writes `pg` directly.
- The KPI/AI-spend read endpoints (`07`, `08`) do **not** audit (reads); all mutations do.

## API Gateway / WAF note

The admin endpoints sit behind the same Cognito authorizer as the rest of the API. Optional IP
allowlisting and the separate distribution are handled in [01 — CDK Hosting & WAF](./01-cdk-hosting-waf.md).

## Checklist

- [ ] `verify-session-jwt.ts` — validate Cognito JWT via JWKS, extract `custom:role`, return session or null
- [ ] Middleware wired to `verifySessionJwt` + `checkAdminRole`; fail-secure preserved on any error
- [ ] Unit tests for `verifySessionJwt` (valid, expired, bad signature, missing claim, wrong audience)
- [ ] `adminRoutes.ts` module + `isAdminRoute` dispatch in `api-handler/index.ts`
- [ ] Server-side `role === 'ADMIN'` guard as the first check in `handleAdminRoute`
- [ ] `role` not mutable via any admin endpoint (documented in RBAC)
- [ ] `admin_audit_log` migration (node-pg-migrate via `database-migrations` skill)
- [ ] `IAdminAuditLog` port + adapter; admin mutations record an entry
- [ ] `npm run validate:security` green (new DDL + adapter)
- [ ] `npm run skill:hexagonal-architecture-validator` exit 0
- [ ] Domain unit tests for the audit writer with a mocked port
