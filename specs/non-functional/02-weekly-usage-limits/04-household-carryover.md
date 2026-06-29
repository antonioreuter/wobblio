# 04 — Household Mid-Week Carry-Over

**Non-Functional 02 · Phase 4/5 · §6.3 credit carry-over on membership transitions**

Parent: [../02-weekly-usage-limits.md](../02-weekly-usage-limits.md) §6.3 · Index: [README](./README.md)

> **Recommended: DEFER** until real mid-week pool-reset gaming is observed. Hardest/riskiest code; guards
> a rare actively-engineered exploit. Ship 01–03 first.

## Base (already built)

User in ≤1 household; `MAX_HOUSEHOLD_MEMBERS = 3`, `MIN_MEMBERS_FOR_POOL = 2`; create = Premium-only. Pool
activates at 2+ members; `quota_counter` pool row keyed by `household_id`, counter `HOUSEHOLD_CREDITS`; RLS
widened (`current_tenant_household_ids()`). `UploadAllowanceResolver` reads the pool cap from the **owner's
role** via `household_owner_role()` SD fn (guarded single read).

## Design — §6.3 transitions

Math in **TypeScript** (new carry-over domain service); SQL = **thin SD writes** applying pre-computed
amounts across the owner↔household tenant boundary. Worked example (`avg`≈10k):

- **Pool activates (2nd member joins):** `HOUSEHOLD_CREDITS := owner personal CREDITS` (e.g. 50k), cap
  `15×avg`. Owner personal frozen **by routing** (no flag — charges go to the pool). Member personal (20k)
  **set aside, not moved**. Both see `50k / 150k`.
- **Uploads pooled:** worker debits `HOUSEHOLD_CREDITS`.
- **Member leaves:** member personal resumes (`20k / 30k`), PREMIUM-via-household revoked; in-household
  spend stays on the pool.
- **Dissolve / last member leaves:** `owner CREDITS := GREATEST(owner CREDITS, HOUSEHOLD_CREDITS)`; cap back
  to owner tier. (Owner personal is retained — hence `GREATEST`, hence pool-only display.)

## `/me/usage` pool-only flip lands HERE

Once carry-over copies owner usage into the pool, `personal + pool` double-counts → when **pooled**,
`used = poolUsed` only. Correct only alongside carry-over (that's why it's not in 01).

## Surfaces

New `IHouseholdRepository`: `carryOverOnPoolActivate`, `settlePoolOnLeave`, `settlePoolOnDissolve` + thin SD
migrations; wire into `HouseholdService.create`/invite-accept/`leave`/`removeMember`/`disband`.

**Invariant:** credits consumed conserved across any join/leave/dissolve; a transition never grants more
remaining credits than legitimately held.

## Checklist

- [ ] Carry-over domain service (TS math) + thin SD write fns
- [ ] Wire into all 5 transition points
- [ ] `/me/usage` → pool-only when pooled
- [ ] Unit tests: conservation across join/leave/dissolve; no free headroom
