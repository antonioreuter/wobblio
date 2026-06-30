---
type: Feature Specification
title: Quotas, Credits, & Household Limits
description: Details the credit-based soft-cap upload limits, database RLS bypass configuration, household membership caps, pool transitions, and churn exploitation guards.
tags: [product, limits, quotas, RLS, household, security]
timestamp: 2026-06-30T22:59:00Z
---

# Quotas, Credits, & Household Limits

Wobblio enforces strict limits on AI processing and resource consumption to prevent abuse, protect operating margins, and handle household membership transitions deterministically.

---

## 1. Credit-Based Limit Model (Soft-Cap-with-Hard-Block)

To account for varying costs of different receipt layouts and language-specific OCR scans, Wobblio measures weekly quotas in **Usage Credits** instead of raw receipt counts:
* **1 Credit = 1 LLM Token** consumed (input + output).
* **Weekly credit caps** are computed dynamically:
  $$\text{Weekly Credit Cap} = \text{Weekly Invoice Quota} \times \text{SSM average\_tokens\_per\_invoice (Default: 10,000)}$$

### Soft-Cap-with-Hard-Block Heuristic
* **Check at Presign:** The quota availability check is evaluated during Step 1 of the upload pipeline (`POST /invoices/presign`).
* **The Rule:** If a tenant’s usage is **strictly less than their weekly cap** (`used_credits < credit_cap`), the upload request is **always approved**, even if processing that receipt subsequently pushes the tenant's usage over the cap.
* **The Block:** Once `used_credits >= credit_cap`, all subsequent presign requests are immediately rejected.
* **Credit Accrual:** Credits are only debited *after* successful processing in the ingestion worker. If an upload fails, **zero credits are charged**, avoiding the need for complex database refund states. Credits do not roll over.

---

## 2. Plan Caps Configuration

SSM parameter configurations define the quota ceilings:

| Parameter | Plan Tier | Invoice Equivalence | Weekly Credit Cap |
|---|---|---|---|
| `/config/quotas/standard_invoices_limit` | `STANDARD` (Free) | 3 invoices | 30,000 credits |
| `/config/quotas/premium_invoices_limit` | `PREMIUM` (Paid) | 10 invoices | 100,000 credits |
| `/config/quotas/household_invoices_limit` | `HOUSEHOLD` (Pooled) | 15 invoices | 150,000 credits |
| `/config/quotas/tester_invoices_limit` | `TESTER` | Custom | Defined in `limits` overrides |
| `/config/quotas/admin_invoices_limit` | `ADMIN` | Unlimited | Infinity |

---

## 3. Database RLS Bypass for Administrative Tasks

To keep the database schema clean and maintainable, **Wobblio strictly avoids stored procedures or functions**. All administrative access and quota adjustments are handled in the TypeScript application layer by temporarily bypassing RLS via session config flags:

```sql
-- Policies supporting RLS bypass settings
CREATE POLICY tenant_isolation ON app_user
  USING (
    id = current_setting('app.current_tenant_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'true'
  );
```

### Admin Search & Quota Adjustments Flow
1. API handler receives a requests to search users or adjust quotas.
2. Handler opens a transaction and elevates session privileges:
   ```sql
   SELECT set_config('app.bypass_rls', 'true', true);
   ```
3. Performs administrative queries (e.g. searching users across tenants or executing upsert adjustments on `quota_counter.used` delta values).
4. Commits the transaction, naturally resetting the session setting.

---

## 4. Household Quotas & Membership Transitions

To prevent users from gaming their weekly limits by repeatedly joining and leaving households mid-week, the system implements strict carry-over rules:

* **Maximum Membership Constraint:** A household can contain a maximum of **3 members total** (1 Owner + up to 2 Invited Members). Inviting a 4th member is blocked in the app layer.
* **Owner-Anchored Pool:** The household pooled quota is anchored on the household owner. The `HOUSEHOLD_CREDITS` counter is simply the owner's weekly usage relabeled and expanded to 150,000 credits.
* **Transition Logic:**
  1. **Member Joins:** The member’s personal `CREDITS` counter is **set aside and frozen** for the week. The member begins drawing from the owner's `HOUSEHOLD_CREDITS` pool.
  2. **Member Uploads:** All uploads targeted at the household space debit the shared `HOUSEHOLD_CREDITS` pool, regardless of which member uploaded them.
  3. **Member Leaves:** The member's set-aside personal `CREDITS` counter resumes its previous value. Any credits spent by the member while in the household **stay in the owner's pool** (they are not returned to the leaver).
  4. **Household Dissolves:** The owner’s personal `CREDITS` is set to:
     $$\text{CREDITS} := \text{GREATEST}(\text{CREDITS}, \text{HOUSEHOLD\_CREDITS})$$
     The cap reverts to the owner's personal tier (100,000). If this pushes the owner over their personal limit, further uploads are blocked until the weekly reset.

---

## 5. Churn Exploitation Guards

To prevent rapid household cycling, the application enforces:
* **Transition Logging:** An audit event (`household_membership_event`) is logged on every create, invite-accept, leave, and dissolution.
* **Transitions Ceiling:** Users are capped at a maximum of **3 transitions per week** (configured in SSM `/config/quotas/max_household_transitions_per_week`).
* **Hard Guard Check:**
  ```typescript
  const transitions = await householdRepo.countMembershipTransitions(userId, week);
  if (transitions >= maxTransitionsPerWeek) {
    throw new HouseholdChurnLimitError('Too many household changes this week.');
  }
  ```
* **Escalation Path:** Flagged accounts trigger push notifications/emails, and continued abuse is queued in the Admin Console for operator suspension.
