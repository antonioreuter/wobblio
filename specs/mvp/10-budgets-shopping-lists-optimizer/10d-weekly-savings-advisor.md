# 10d — Weekly AI Savings Advisor

**Epic 8 | Phase 4 | Premium feature core**

## Overview

One Bedrock call per Premium user per week (EventBridge cron), producing a short plain-text savings summary card. Unchanged by the [10b](./10b-shopping-lists.md)/[10c](./10c-split-route-optimizer.md) shopping-list refactor — extracted here purely to give it its own file. It consumes the split-route estimate from [10c](./10c-split-route-optimizer.md) as one of its inputs but has no other coupling to the list/optimizer redesign.

## Dependencies

- [08 — Data Intelligence Layer](../08-data-intelligence-layer.md) (price findings)
- [10a — Budgets](./10a-budgets.md) (budget status input)
- [10c — Split-Route Optimizer](./10c-split-route-optimizer.md) (split-route estimate input)

## Weekly AI Savings Advisor (Prompt B.5)

One Bedrock call per Premium user per week (EventBridge cron). Model role: `insight` (Sonnet-class).

Input: pre-aggregated system-computed facts only (never raw invoices, never other tenants' data):
- `spend_this_week` vs `last_week` (delta %)
- `budget_status` (per-budget remaining)
- `price_findings` (product, your price, cheapest regional price, merchant, observation count — k≥3 enforced before entering prompt)
- `split_route_estimate` (saving, store count) or null

Output: ≤120 words plain text, ≤3 findings, no emoji, no financial advice beyond grocery shopping, in user's language.

Stored in `invoice` or a weekly advisor table; surfaced as a card on Home (mobile) and Dashboard (web).

---

## Checklist

### Weekly AI Savings Advisor
- [x] `weekly-advisor` EventBridge cron Lambda (runs weekly) — `Source/backend/src/handlers/cron-weekly-advisor/index.ts`
- [x] Targets only Premium users with ≥1 invoice in the past week
- [x] Pre-aggregate all required facts server-side before Bedrock call
- [x] Enforce k≥3 on price findings before including in prompt (§6.5)
- [x] Bedrock call with B.5 prompt (Sonnet-class insight model, SSM-configured)
- [x] Result stored and surfaced as advisor card on Home/Dashboard
- [x] Old advisor card replaced each week (not accumulated)
