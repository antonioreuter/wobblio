# Spec amendment — Own price history is served over the full 26-week window for all tiers

**Date:** 2026-07-05
**Status:** adopted
**Amends:** §6.5.5 (cold-start mitigations / free-tier own-history window)
**Related:** `specs/price-trends-gaps/` (00-handoff, sub-spec 03)

## What changed

§6.5.5 describes the user's own price history as available to the **free tier within a 2-month
window**, with the **full history reserved for Premium**. That tiering is **removed**: the caller's
own purchase history is served over the same **26-week (6-month) trailing window** (`TREND_WINDOW_WEEKS`)
for **every tier** — STANDARD, PREMIUM, TESTER, ADMIN alike.

Premium gating on the price-trends report is unchanged in every other respect: the de-identified
**market** trend (per-merchant, k≥3) remains Premium-only. Only the **own-history window** is
un-tiered.

## Why

- Own price history is the product's **day-1 value hook** — "you paid 12% more for this than last
  month" works from the very first scan, independent of regional density (§6.5.5, §6.8). Clipping it
  to 2 months blunts exactly the moment a new user first sees the product working.
- It is also the strongest **contribution motivator**: the more of their own history a user can see,
  the more reason they have to keep scanning — which is what feeds the anonymous price index the
  whole differentiator depends on. Restricting it works against the flywheel.
- Own history is **RLS-scoped to the caller's own `invoice_line` rows** — there is no cross-tenant
  or privacy consideration in showing a user more of their own data. The 2-month limit was a
  monetisation lever with no data-protection basis, and a weak lever: it degrades the free experience
  precisely where we want engagement.
- The implementation already serves 26 weeks to all tiers (`PriceTrendService`,
  `OwnPurchaseHistoryQueryAdapter`). This amendment **ratifies the shipped behaviour** rather than
  changing code, and removes the stale spec claim that a reviewer would otherwise flag as a bug.

## Mechanical impact

- **No code change** — matches current behaviour (`TREND_WINDOW_WEEKS = 26` applied to both market
  and own-history queries regardless of role in `PriceTrendService.comparison`).
- `specs/mvp/11-bill-splitting-fx-reporting.md` — remove/adjust any acceptance checklist item that
  repeats the free-tier 2-month own-history limit, if present.
- The Premium differentiator on this report stays: **market comparison** (per-merchant, k≥3,
  6-month) remains Premium-only. Nothing in this amendment touches that gate.
