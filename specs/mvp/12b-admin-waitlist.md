# 12b — Waitlist Panel

**Epic 10 | Phase 5 | Parent: [12 — Admin Console](./12-admin-console.md)**

Admin view of the waitlist guardrail (§2.5) and a manual FIFO release control. Smallest slice —
mostly an HTTP wrapper over logic that already exists as a cron.

## Dependencies

- [12a — Admin Foundation](./12a-admin-foundation.md) (route family, role gate, audit log)
- [04 — Authentication & Waitlist](./04-authentication-waitlist.md)

## Backend

Endpoints (in `adminRoutes.ts`, ADMIN-gated):

- `GET /admin/waitlist` → `{ freeUserCount, cap, waitlistQueueSize }`.
- `POST /admin/waitlist/release` `{ count: N }` → runs the FIFO release for N users; audit-logged.

### Reuse (do not reinvent)

- `WaitlistReleaseService` (`core/services/waitlist/`) — already reads cap from SSM, fetches the
  FIFO batch, flips status. The admin `POST` is a thin caller; the cron
  (`handlers/cron-waitlist-release/index.ts`) is the precedent.
- DB helpers `get_waitlisted_batch(limit)` / `release_waitlisted_users(uuid[])`,
  `system_counter.waitlist_count`.
- Adapters `SsmWaitlistCapAdapter`, `WaitlistRepositoryAdapter`, `FreeUserCounterAdapter`.

The `GET` composes: free-user count (`FreeUserCounterAdapter`), cap (`SsmWaitlistCapAdapter`),
queue size (`WaitlistRepositoryAdapter.getWaitlistCount()`).

## Frontend (`Source/admin/`)

`(console)/waitlist/page.tsx`:

- Stat cards (`stat-card`): free-user count vs cap, waitlist queue size.
- "Release N users" form → `POST /admin/waitlist/release`; success toast with released count.
- "Raise cap" link to the SSM param editor (12c) for `max_free_users_cap`.

## Open decisions

- Cap on `N` per release call (avoid an accidental mass release). Recommend a server-side
  `count ≤ 500` guard, surfaced as a 400 with the limit.

## Checklist

- [ ] `GET /admin/waitlist` (count, cap, queue size) via existing adapters
- [ ] `POST /admin/waitlist/release {count}` calling `WaitlistReleaseService`; audit-logged
- [ ] Server-side `count` bound (400 over limit)
- [ ] `waitlist/page.tsx` stat cards + release form + cap-editor link
- [ ] Unit test: release handler delegates to service, records audit row, enforces bound
- [ ] Hexagonal validator exit 0

## Verification

- Seed N waitlisted users; `GET` reflects queue size; `POST {count: k}` releases exactly k
  (FIFO order) and `GET` queue size drops by k; one audit row written.
- `count` over the bound → 400, no release, no audit row.
