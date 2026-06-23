# 04 — Waitlist Panel

**Epic 10 | Phase 5 | Live waitlist visibility + manual FIFO release**

## Overview

Operator view of the free-user count versus the cap, the waitlist queue size, and a button to release
N users via the existing FIFO release job. Cap changes link to the SSM editor.

Most of this is already built — `WaitlistReleaseService` and the `cron-waitlist-release` handler exist,
and `WaitlistRepositoryAdapter` already exposes `getWaitlistCount()`. This sub-spec adds the thin read
endpoint and a manual-trigger wrapper around the existing release service.

Parent: [12 — Admin Console](../12-admin-console.md).

## Dependencies

- [00 — Access Control, Routing & Audit](./00-access-control-routing-audit.md) (admin route module + audit log)
- [04 — Authentication & Waitlist](../04-authentication-waitlist.md) (`WaitlistReleaseService`, free-user counter, `max_free_users_cap`)

## Endpoints

- `GET /admin/waitlist` — current free-user count, `max_free_users_cap` (from SSM), and waitlist queue
  size (`STATUS_WAITLIST`). Reuse the existing free-user counter + waitlist count adapters.
- `POST /admin/waitlist/release` with `{ count: N }` — invoke the existing `WaitlistReleaseService`
  FIFO release for N users. Record `admin_audit_log` (`action=waitlist.release`, target = N released).
  Validate `N` is a positive integer within a sane bound.

## UI

- Live count vs cap, queue size.
- "Release N users" input + button (confirmation modal).
- "Raise cap" links to [02 — SSM Parameter Editor](./02-ssm-parameter-editor.md) (`max_free_users_cap`).

## Checklist

- [ ] `GET /admin/waitlist` — count, cap, queue size (reuse existing counter + waitlist adapters)
- [ ] `POST /admin/waitlist/release` — calls existing `WaitlistReleaseService`, validates N, audited
- [ ] UI: count/cap/queue display, release input + confirmation modal, cap link to SSM editor
- [ ] `data-testid` on count display, release input, release button
- [ ] Domain unit tests with mocked release service + audit ports
- [ ] `npm run skill:hexagonal-architecture-validator` exit 0
