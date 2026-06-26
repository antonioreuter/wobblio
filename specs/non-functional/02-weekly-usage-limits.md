# 02 — Weekly Usage and Credit Limits

**Non-Functional Specification | Phase 4/5 | Weekly Usage and Credit Enforcement**

## Overview

This specification details the architecture for enforcing weekly usage limits on invoice uploads. Since invoice processing utilizes expensive vision LLMs (e.g., Claude or Qwen), we must prevent resource abuse while maintaining a high-quality user experience. 

To achieve this, the system is unified under a single **Credit-Based Limit model** (where 1 Credit = 1 LLM Token consumed). The weekly credit caps are dynamically derived from the number of allowed invoices multiplied by the average token count per invoice. Enforcing this follows a **Soft-Cap-with-Hard-Block** strategy.

To comply with clean architectural standards, **we strictly avoid database stored procedures or functions**. All administrative access and quota adjustments are handled in the application layer via safe session-level context-switching and Row-Level Security (RLS) bypass flags.

---

## 1. Core Premise: Soft-Cap-with-Hard-Block

Under the **Soft-Cap-with-Hard-Block** (threshold-based block) strategy:
- Quota checks are performed at the initiation of the upload request (when generating the S3 presigned URL).
- If the tenant's current usage is **strictly less than their weekly credit cap** (`used_credits < credit_cap`) when requesting a new upload, the upload is **always permitted**, even if processing that invoice will cause the total usage to exceed the cap.
- Once the tenant's usage meets or exceeds the cap (`used_credits >= credit_cap`), any subsequent upload requests are rejected immediately.
- This allows a user to fully process their "last invoice" of the week without getting interrupted mid-workflow.
- **No Rollover**: Credits are tied to a specific week and do not transfer from one week to another. Because quota tables partition usage by a `week_start` date, limits naturally reset every week.

### Scenario Example:
- **Expected Average Invoice Cost**: 10,000 tokens (credits) per invoice.
- **Premium Limit**: 10 invoices/week = 100,000 credits/week.
- **Current Used**: 95,000 credits.
- **Action**: User requests a new invoice upload.
- **Check**: `95,000 < 100,000` is `true`. The request is accepted.
- **Result**: The invoice is processed. Due to OCR and complexity, it consumes 8,500 credits. `used_credits` becomes `103,500`.
- **Next Action**: User requests another upload.
- **Check**: `103,500 < 100,000` is `false`. The request is rejected with `QuotaExceededError`.

---

## 2. Quota Definition & Configurations

The system measures quota usage strictly in **Usage Credits** (1 credit = 1 LLM token consumed).

### Weekly Credit Cap Calculation

The weekly credit cap for a tenant is computed dynamically:

$$\text{Weekly Credit Cap} = \text{Weekly Invoice Quota} \times \text{Average Tokens Per Invoice}$$

These variables are configured in the SSM Parameter Store:
- `/wobblio/config/quotas/average_tokens_per_invoice` (Default: `10000`)
- `/wobblio/config/quotas/standard_invoices_limit` (Default: `3` -> `30,000` credits)
- `/wobblio/config/quotas/premium_invoices_limit` (Default: `10` -> `100,000` credits)
- `/wobblio/config/quotas/household_invoices_limit` (Default: `15` -> `150,000` credits)
- `/wobblio/config/quotas/tester_invoices_limit` (Default: `-1` / Infinity)
- `/wobblio/config/quotas/admin_invoices_limit` (Default: `-1` / Infinity)

---

## 3. Architectural Integration & Invariant Checks

Following the strict import directionality rules (per [code-quality-guard.md](../../.claude/rules/code-quality-guard.md)), quota operations are managed in the core layer.

```
                           POST /invoices/upload-url
                                       │
                                       ▼
                       PresignService (Core Domain)
                                       │
                        Resolves Credit Cap from SSM
                                       │
                       QuotaService.checkAvailability()
                                       │
                                       ▼
                       Is used_credits < credit_cap ?
                                       │
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
             If authorized:                          If unauthorized:
          Return presigned URL                        Throw QuotaExceededError
          (No charge at this stage)
                   │
                   ▼
       Ingestion Worker (Worker Stack)
       Processes Ingest -> Calls Bedrock -> Parsed
       Retrieves tokens consumed (input + output)
       Increments used_credits by actual tokens consumed
```

### Core Interface Port

The `IQuotaRepository` handles quota state persistence:

```typescript
// Source/backend/src/core/ports/quota/IQuotaRepository.ts
export type QuotaType = 'CREDITS' | 'HOUSEHOLD_CREDITS';

export interface IQuotaRepository {
  getUsed(tenantId: string, type: QuotaType, weekStart: string): Promise<number>;
  increment(tenantId: string, type: QuotaType, weekStart: string, amount: number): Promise<void>;
  decrement(tenantId: string, type: QuotaType, weekStart: string, amount: number): Promise<void>;
}
```

### Domain Enforcement Flow

The `QuotaService` handles the limit validation:

```typescript
// Source/backend/src/core/services/quota/QuotaService.ts
export class QuotaService {
  constructor(private readonly quotaRepo: IQuotaRepository) {}

  getWeekStart(date: Date): string {
    return weekStart(date.toISOString().slice(0, 10));
  }

  async checkAvailability(tenantId: string, type: QuotaType, cap: number, now: Date): Promise<boolean> {
    if (cap === Number.POSITIVE_INFINITY) return true;
    const week = this.getWeekStart(now);
    const used = await this.quotaRepo.getUsed(tenantId, type, week);
    return used < cap;
  }
}
```

### Ingestion Worker Credit Consumption

Credits are consumed only **after** the LLM parsing is complete:
- **Success Case**: The worker retrieves the token metadata, maps it directly to credits (1 token = 1 credit), and adds it to the user's weekly counter.
- **Failure Case**: Since credits are only written *after* successful processing, if an ingestion run fails, **zero credits** are charged. This eliminates the need for database refund code and failure caps.

```typescript
// Source/backend/src/handlers/ingestion-worker/index.ts
const actualTokens = telemetry.inputTokens + telemetry.outputTokens;
const creditType = householdId ? 'HOUSEHOLD_CREDITS' : 'CREDITS';
const quotaOwnerId = householdId ?? tenantId;

await quotaRepo.increment(quotaOwnerId, creditType, weekStart, actualTokens);
```

---

## 4. Row-Level Security (RLS) & Database Schema

The `quota_counter_type` enum is updated to track credits.

### Schema Migration (`xxxxxx_add_credits_to_quota_counter.ts`)

```sql
-- Up Migration
ALTER TYPE quota_counter_type ADD VALUE IF NOT EXISTS 'CREDITS';
ALTER TYPE quota_counter_type ADD VALUE IF NOT EXISTS 'HOUSEHOLD_CREDITS';
```

### Clean RLS Bypass Design

To avoid database stored procedures, Row-Level Security (RLS) policies on administrative tables (`app_user` and `quota_counter`) allow session-level bypass checks. This lets the application layer toggle an RLS bypass using a local PostgreSQL session setting (`app.bypass_rls`).

```sql
-- Recreate policies to support the RLS bypass session setting
DROP POLICY IF EXISTS tenant_isolation ON app_user;
CREATE POLICY tenant_isolation ON app_user
  USING (
    id = current_setting('app.current_tenant_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_isolation ON quota_counter;
CREATE POLICY tenant_isolation ON quota_counter
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'true'
  );
```

---

## 5. Application-Layer Administrative Operations

All queries cross-cutting tenant boundaries are executed directly from the TypeScript codebase inside a transaction. The application temporarily elevates privileges by setting the `app.bypass_rls` config.

### User Search and Admin Views

Instead of stored database functions like `admin_search_users_by_email`, the admin console endpoints execute SQL queries directly from TS:

```typescript
// Source/backend/src/handlers/api-handler/adminQuotaRoutes.ts
async function searchUsers(db: PoolClient, emailQuery: string, week: string): Promise<UserSearchResult[]> {
  await db.query("BEGIN");
  try {
    // Elevate privileges for this transaction only
    await db.query("SELECT set_config('app.bypass_rls', 'true', true)");

    const usersRes = await db.query<{ id: string; email: string; role: string }>(
      `SELECT id, email, role FROM app_user 
       WHERE email ILIKE $1 
       ORDER BY email LIMIT 20`,
      [`%${emailQuery}%`]
    );

    const ids = usersRes.rows.map(u => u.id);
    const quotasRes = await db.query<{ tenant_id: string; used: number }>(
      `SELECT tenant_id, used FROM quota_counter 
       WHERE week_start = $1 AND tenant_id = ANY($2) AND counter = 'CREDITS'`,
      [week, ids]
    );

    // Map and build response object in TS...
    await db.query("COMMIT");
    return results;
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}
```

### Current-Week Quota Adjustments

Admins can adjust the user's weekly credits. Positive values grant extra credits (decrements `used`), negative values consume credits (increments `used`). TypeScript performs the upsert directly:

```typescript
// Source/backend/src/handlers/api-handler/adminQuotaRoutes.ts
async function adjustQuota(
  db: PoolClient,
  targetUserId: string,
  week: string,
  delta: number
): Promise<number> {
  await db.query("BEGIN");
  try {
    await db.query("SELECT set_config('app.bypass_rls', 'true', true)");

    const result = await db.query<{ used: number }>(
      `INSERT INTO quota_counter (tenant_id, counter, week_start, used)
       VALUES ($1, 'CREDITS', $3, GREATEST(0, -$4))
       ON CONFLICT (tenant_id, counter, week_start)
       DO UPDATE SET used = GREATEST(0, quota_counter.used - $4)
       RETURNING used`,
      [targetUserId, week, delta]
    );

    await db.query("COMMIT");
    return result.rows[0].used;
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}
```

---

## 6. Household Limitations

The household system enforces strict boundaries on sharing to avoid premium subscription bypass:

1. **Max Membership Constraint**:
   - A household can only contain up to **3 members total** (1 Owner + up to 2 Invited Members).
   - The validation check occurs during invitation creation and acceptance:
     ```typescript
     const memberCount = await householdRepo.getMemberCount(householdId);
     if (memberCount >= 3) {
       throw new HouseholdLimitExceededError("Households are limited to a maximum of 3 members.");
     }
     ```
2. **Weekly Upload Limits Adaptation**:
   - Operating with a household changes the weekly uploads cap to a maximum of **15 invoices** (down from the legacy 20 invoices).
   - Using the formula-derived cap (15 invoices $\times$ 10,000 average tokens), the weekly household credit cap is set to **150,000 credits/week**.
   - This value is managed in the SSM parameter `/wobblio/config/quotas/household_invoices_limit` which will be updated from `20` to `15`.
   - The additive pooling rule applies: personal uploads use the personal credit quota (e.g., 100,000 credits/week for Premium), while household-space uploads draw from the pooled household credit quota (150,000 credits/week).

---

## 7. User Interface and Copy Updates

To unify the terminology, all references to "invoices" or "scans" in quota views must be changed to "Credits" or "Usage Credits". Numbers are formatted cleanly with thousands separators.

### A. Web Application UI Updates

1. **Top Bar Quota Indicator (`top-bar.tsx`)**:
   - Label: Change `"Invoices this week"` to `"Credits this week"`.
   - Tooltip: Change `"Invoices processed this week"` to `"Usage credits consumed this week"`.
   - Format: Render both numerator and denominator with thousands formatting:
     ```typescript
     {usage ? <><strong>{usageUsed.toLocaleString()}</strong> / {unlimited ? '∞' : usageLimit.toLocaleString()}</> : '—'}
     ```
   - Progress bar calculation: Remains `Math.max(0, Math.min(100, (usageUsed / Math.max(1, usageLimit)) * 100))`.

2. **Dashboard Usage Card (`dashboard/page.tsx`)**:
   - Change `label="Scans Remaining"` to `label="Credits Remaining"`.
   - Update value suffix to credits: `<AnimatedNumber value={usage.remaining ?? 0} /> credits left`.
   - Change delta text to: `${usage.used.toLocaleString()} of ${usage.cap.toLocaleString()} credits used this week`.
   - Update warning threshold: Trigger warning tone when remaining credits are low (under 3 average invoices worth of credits):
     ```typescript
     // Low quota warning triggers at <= 30,000 credits remaining
     tone={usage && !usage.unlimited && (usage.remaining ?? 0) <= 30000 ? 'warning' : 'neutral'}
     ```

3. **Upload Error Popup (`upload-receipt.ts`)**:
   - Change 429 quota exhaustion message to:
     `"You’ve reached your weekly usage credit limit."`

4. **Pricing and Marketing Views (`landing-page-view.tsx` & Household explanations)**:
   - Standard: `"30,000 weekly credits (~3 receipt scans)"` instead of `"3 scans per week"`.
   - Premium: `"100,000 weekly credits (~10 scans)"` instead of `"10 scans per week"`.
   - Household: `"150,000 weekly credits pooled (~15 scans)"` instead of `"pooled scans"`.

### B. Admin Console UI Updates (`users-section.tsx`)

1. **Adjust Quota Increments**:
   - Adjusting by a single unit is meaningless for credits (1 credit = 1 token). Therefore, the adjustment buttons are configured to add/subtract **10,000 credits** (equivalent to 1 average invoice scan).
   - Plus button: `setPendingAdjust({ user, delta: 10000 })`
   - Minus button: `setPendingAdjust({ user, delta: -10000 })`

2. **UI Texts and Dialogs**:
   - Quota display: `{user.quotaUsed.toLocaleString()} / {user.quotaCap === null ? '∞' : user.quotaCap.toLocaleString()}`
   - Action Tooltips:
     - `title="Add 1 scan"` -> `title="Add 10,000 credits"`
     - `title="Remove 1 scan"` -> `title="Remove 10,000 credits"`
   - Confirmation Dialog:
     - Title: `Adjust weekly credits?`
     - Body: `${pendingAdjust.delta > 0 ? 'Grant' : 'Consume'} ${Math.abs(pendingAdjust.delta).toLocaleString()} credits for ${pendingAdjust.user.email}.`

---

## 8. Verification & Testing Plan

### Automated Tests

- **Unit Tests (`QuotaService.test.ts`)**:
  - Test that `checkAvailability` returns `true` if `used_credits < credit_cap`.
  - Test that `checkAvailability` returns `false` if `used_credits >= credit_cap`.
  - Verify that the presign check allows one last invoice to process even if it consumes credits that push the user over the limit.
- **Integration Tests (`InvoiceUploadLimits.test.ts`)**:
  - Verify that RLS bypass is correctly set session-wide and allows cross-tenant updates inside TypeScript.
  - Test parallel upload requests: Ensure concurrent requests verify limits independently and succeed if initiated below the threshold, but subsequently block out the tenant.
  - Test household membership limits: Verifying that inviting a 4th member is blocked.

### Manual Verification Checklist

- **Admin Action Test**:
  - Search for a user in the Admin console, adjust their credit quota delta, and verify that the DB matches.
- **Ingestion Failure Test**:
  - Simulate a parsing failure for an invoice and verify that the user's weekly credits are not incremented.
