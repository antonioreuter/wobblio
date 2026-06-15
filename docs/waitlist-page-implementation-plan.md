# Waitlist Page — Implementation Plan (deferred)

> Status: **planned, not implemented.** Captured for later pickup.
> Decisions locked with product owner:
> - **Position framing:** approximate count ("X people waiting"), **no** per-user FIFO endpoint.
> - **Premium-skip CTA:** **deferred** until billing/checkout (Epic 05) is wired in the webapp.
> - **Scope of this doc:** the `/waitlist` page + the minimal data plumbing it needs. The deeper
>   "make the waitlist trigger for real" provisioning fix is documented separately below as a
>   **known blocker**, since without it no real user reaches `WAITLIST` status.

Spec references: v2.4 §2.5 (waitlist guardrail), §13.2 / `specs/mvp/06-landing-page-marketing.md`
(dynamic CTA + waitlist screen), `specs/mvp/04-authentication-waitlist.md` (flow).

---

## Context / why

The landing hero CTA flips to **"Join the priority waitlist"** when the free-user cap is reached
(`landing-page-view.tsx:270-272`) and links to `/waitlist`. **That route does not exist** — a true
cap state currently 404s. This plan builds the `WaitlistScreen` the CTA points at.

Related fix already shipped: `WaitlistStatusDbAdapter` now reads `free_user_count` (not
`waitlist_count`), so `GET /waitlist/status` correctly reports `waitlistActive` at the right time.

---

## 1. Backend — expose the approximate waiting count

The page shows "X people waiting", so `GET /waitlist/status` must also return the current
waitlist size. Today it returns only `{ waitlistActive }`.

**Files:**
- `Source/backend/src/core/ports/IWaitlistStatusPort.ts`
  Change the port to return both fields:
  ```ts
  export interface WaitlistStatus {
    waitlistActive: boolean;
    waitingCount: number;
  }
  export interface IWaitlistStatusPort {
    getStatus(): Promise<WaitlistStatus>;
  }
  ```
- `Source/backend/src/infrastructure/adapters/WaitlistStatusDbAdapter.ts`
  Read both counters in one query and derive both fields. Reuse the existing key constants/pattern:
  ```sql
  SELECT name, value FROM system_counter
  WHERE name IN ('free_user_count', 'waitlist_count')
  ```
  - `waitlistActive` = `free_user_count >= maxFreeUsers` (unchanged semantics)
  - `waitingCount`   = `waitlist_count` (the already-waitlisted total — the approximate "ahead of you")
- `Source/backend/src/handlers/waitlist-status/index.ts`
  `buildWaitlistStatusResponse` returns `{ waitlistActive, waitingCount }`; keep the existing
  `Cache-Control: public, s-maxage=300, stale-while-revalidate=60` header.

**Tests to update/add:**
- `Source/backend/src/tests/unit/infrastructure/adapters/WaitlistStatusDbAdapter.test.ts`
  (already exists) — extend to assert both counters are read and `waitingCount` is returned;
  cover the missing-row → `0` case.
- `Source/backend/src/tests/unit/handlers/waitlist-status.test.ts` — update the port mock to
  `getStatus()` and assert the body now includes `waitingCount`.

No migration change — both counter rows already exist
(`20260611152000_initial_schema.ts:450` seeds `free_user_count`,
`20260611170000_auth_rls_helpers.ts:6` seeds `waitlist_count`).

> Note: `waitingCount` is "good enough" social proof, not a per-user rank. The spec's literal
> "N ahead of *you*" requires the user's FIFO position; that's intentionally **out of scope**
> per the locked decision.

---

## 2. Frontend hook — surface the count

**File:** `Source/webapp/src/hooks/use-waitlist-status/use-waitlist-status.ts`

Extend the hook to also return `waitingCount`:
- Add `const [waitingCount, setWaitingCount] = useState<number>(0)`.
- In the `.then`, `setWaitingCount(Number(data.waitingCount ?? 0))`.
- Return `{ waitlistActive, waitingCount, loading }`.
- Keep all existing fallbacks (missing base URL / fetch reject → `waitlistActive=false`, count `0`).

**Test:** `use-waitlist-status.test.ts` — extend the resolved-state test to assert
`waitingCount` parses from the mocked response; keep the fallback tests green.

---

## 3. Frontend — the `/waitlist` route

**New files:**
- `Source/webapp/src/app/(auth)/waitlist/page.tsx` — server component, page shell.
- `Source/webapp/src/app/(auth)/waitlist/waitlist-view.tsx` — `'use client'` component that
  calls `useWaitlistStatus()` and renders the screen.

Place it under the **`(auth)` route group** so it reuses the existing `auth-screen` / `auth-card`
/ `glass` layout (mirror `(auth)/register/page.tsx`). It is a public route (no auth guard) —
the hero links unauthenticated visitors here.

**Page composition (reuse `src/components/ds/`):**
- `WobblioLogo size={30} withWordmark` brand header (as in register page).
- Title: **"You're on the priority list."**
- Subline using the count: when `waitingCount > 0` →
  *"You're in good company — {waitingCount.toLocaleString('nl-NL')} people are waiting."*
  When `0` (or `loading`) → neutral copy: *"We'll email you the moment your spot opens."*
  Use `AnimatedNumber` for the count for polish.
- A short "what happens next" list (3 items): we email you when a slot frees up (FIFO) ·
  nothing to do in the meantime · your place is saved.
- **Premium-skip CTA: DEFERRED.** Do **not** render a Stripe link yet. Leave a clearly marked
  placeholder comment referencing Epic 05 so it's a one-line addition later, e.g.:
  ```tsx
  {/* TODO(Epic 05 billing): "Skip the line — go Premium" CTA → Stripe Checkout */}
  ```
- Secondary action: `Link href="/login"` ("Already have access? Sign in") and a back-to-home link.
- Footer legal line identical to register page (`ShieldCheck` + RLS/GDPR/EU-hosted).

**Conventions to honor (webapp CLAUDE.md DoD):**
- Dark-mode parity via Tailwind `dark:` (no runtime theme swap).
- `data-testid` on the key nodes: `waitlist-screen`, `waitlist-count`, `waitlist-signin-link`.
- Responsive down to 768px (375px for marketing-adjacent screens per spec).
- WCAG AA contrast; keyboard-navigable links.

**Analytics:** the hero already emits `waitlist_join` on click (`landing-page-view.tsx:276`).
Optionally emit a `waitlist_view` event on mount via `useAnalytics().track` for funnel symmetry
(Epic 15 KPI). Low priority.

---

## 4. KNOWN BLOCKER (separate task, not in this page's scope)

**Provisioning never sets `WAITLIST` status.** `Source/webapp/src/lib/provision-user.ts:22`
hardcodes `'ACTIVE'` and never consults the cap/counter, so cap-exhausted signups still become
`ACTIVE`. The correct gating logic already exists server-side in
`Source/backend/src/core/services/UserProvisioningService.ts` (`capProvider` + `counter.tryClaimSlot`).

To make the waitlist functionally real (users actually landing on `/waitlist` after signup), the
webapp provisioning path (`provision-user.ts`, called from `src/auth.ts` and
`src/app/(auth)/actions.ts`) must either:
- call the backend provisioning service/endpoint, or
- replicate the cap check by calling `provision_new_user` with `WAITLIST` when
  `free_user_count >= cap` (mirroring `UserProvisioningService.provisionUser`), then redirect a
  `WAITLIST`-status user to `/waitlist` after login/confirm.

Until this is done, `/waitlist` is reachable only via the public hero CTA and shows the
informational screen, but no authenticated user is ever forced onto it.

---

## 5. Verification

Backend (`Source/backend/`):
- `npm run test:unit` — updated adapter + handler tests green.
- `npm run skill:hexagonal-architecture-validator` — exit 0.

Webapp (`Source/webapp/`):
- `npm run test:unit` — hook test green.
- `npm run lint` / `npm run build`.
- Manual: with `NEXT_PUBLIC_API_BASE_URL` pointed at a stack where `free_user_count >= cap`,
  load `/` → hero CTA reads "Join the priority waitlist" → click → `/waitlist` renders with the
  count. Toggle the counter below cap → CTA reverts to "Start ingesting free".

---

## File checklist

| Action | Path |
|---|---|
| edit | `Source/backend/src/core/ports/IWaitlistStatusPort.ts` |
| edit | `Source/backend/src/infrastructure/adapters/WaitlistStatusDbAdapter.ts` |
| edit | `Source/backend/src/handlers/waitlist-status/index.ts` |
| edit | `Source/backend/src/tests/unit/infrastructure/adapters/WaitlistStatusDbAdapter.test.ts` |
| edit | `Source/backend/src/tests/unit/handlers/waitlist-status.test.ts` |
| edit | `Source/webapp/src/hooks/use-waitlist-status/use-waitlist-status.ts` |
| edit | `Source/webapp/src/hooks/use-waitlist-status/use-waitlist-status.test.ts` |
| new  | `Source/webapp/src/app/(auth)/waitlist/page.tsx` |
| new  | `Source/webapp/src/app/(auth)/waitlist/waitlist-view.tsx` |
| (blocker, separate task) | `Source/webapp/src/lib/provision-user.ts` + callers |
