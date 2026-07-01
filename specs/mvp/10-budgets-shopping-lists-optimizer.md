# 10 — Budgets, Shopping Lists & Route Optimizer

**Epic 8 | Phase 4 | Premium feature core**

> **This epic is split into vertical-slice sub-specs (`10a`–`10d`).** This file is the index
> and shared context. Each section's detail, endpoints, and checklist live in its sub-spec.

## Overview

Budget definitions with 85%/100% alerts (EventBridge cron-driven), shopping list management with offline mobile support and public-weblink sharing, the split-route optimizer that groups a list across the cheapest nearby stores, and a weekly AI savings advisor card.

**Current status:** all four sub-features have a full end-to-end implementation (domain/port/service/adapter/handler/CDK/migrations/webapp) in `Source/backend/` and `Source/webapp/`. [10a](./10-budgets-shopping-lists-optimizer/10a-budgets.md) and [10d](./10-budgets-shopping-lists-optimizer/10d-weekly-savings-advisor.md) are shipped as originally spec'd. [10b](./10-budgets-shopping-lists-optimizer/10b-shopping-lists.md) and [10c](./10-budgets-shopping-lists-optimizer/10c-split-route-optimizer.md) are mid-refactor: category-gated item search, per-item quantity, store-removal reallocation, Premium per-list region override, and public weblink/WhatsApp sharing with buy-checkboxes.

## Sub-spec map

| Spec | Scope | Blocking | Status |
|---|---|---|---|
| [10a — Budgets](./10-budgets-shopping-lists-optimizer/10a-budgets.md) | Budget definitions, nightly accumulation/alert cron | — | ✅ Done |
| [10b — Shopping Lists](./10-budgets-shopping-lists-optimizer/10b-shopping-lists.md) | List CRUD, category lock, quantity, quota, offline sync, weblink/WhatsApp sharing | — | 🔧 Refactor in progress |
| [10c — Split-Route Optimizer](./10-budgets-shopping-lists-optimizer/10c-split-route-optimizer.md) | Store-grouping algorithm, store-removal reallocation, Premium region override | 10b | 🔧 Refactor in progress |
| [10d — Weekly AI Savings Advisor](./10-budgets-shopping-lists-optimizer/10d-weekly-savings-advisor.md) | Weekly Bedrock savings-summary card | 10a, 10c | ✅ Done |

## Cross-epic dependencies

- [04 — Authentication & Waitlist](./04-authentication-waitlist.md)
- [07 — Core Ingestion Pipeline](./07-core-ingestion-pipeline.md) (transaction-date budget attribution)
- [08 — Data Intelligence Layer](./08-data-intelligence-layer.md) (price observations, product catalog)
- [09 — Households](./09-households.md) (member-scoped budgets)
