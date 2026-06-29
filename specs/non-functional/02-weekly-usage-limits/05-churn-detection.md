# 05 — Household Churn Detection

**Non-Functional 02 · Phase 5/5 · Anti-exploitation membership-churn detection**

Parent: [../02-weekly-usage-limits.md](../02-weekly-usage-limits.md) §6.4 · Index: [README](./README.md)

> **Recommended: DEFER** alongside 04. Depends on 04 (carry-over) landing first.

## Design

- **Audit log:** emit `household_membership_event` per create/invite-accept/leave/dissolve with `action`,
  `householdId`, `ownerId`, `userId`, `week`, `personalUsedAtTransition`, `householdUsedAtTransition`. Reuse
  `admin_audit_log` (global, no RLS) with a new action, or a dedicated table if richer querying is needed.
- **Per-week threshold:** SSM `/wobblio/config/quotas/max_household_transitions_per_week` (default 3);
  `countMembershipTransitions(userId, week)` (SD fn or audit-log count).
- **Hard guard:** reject create/invite-accept once `transitions >= max` → `HouseholdChurnLimitError`.
- **Escalation:** notify the flagged user (in-app + push); surface flag + event trail in the admin console
  for operator review. Suspension/revocation is an operator action, never automatic.

## Checklist

- [ ] `household_membership_event` emitted on every transition with the usage snapshot
- [ ] `countMembershipTransitions` + SSM threshold
- [ ] Hard guard on create/invite-accept → `HouseholdChurnLimitError`
- [ ] User notification + admin surfacing of flagged accounts
- [ ] Unit tests: guard throws past threshold; event logged per transition
