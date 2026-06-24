---
type: Database Reference
title: Database Multi-Tenancy & Schema Structure
description: Row-Level Security isolation, connection pooling constraints, and schema changes.
tags: [database, postgres, rls, security]
timestamp: 2026-06-23T21:53:00Z
---

# Database Multi-Tenancy & Schema Structure

Wobblio shares a single PostgreSQL database instance (`db.t3.micro`) using Row-Level Security (RLS) policies to ensure strict tenant isolation, alongside RLS-exempt tables for global crowdsourced price data.

## 1. Row-Level Security (RLS) Isolation

Every tenant-scoped table is RLS-protected. The isolation policy filters rows using a PostgreSQL session variable:
```sql
ALTER TABLE invoice ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoice
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

### Handler Rule
Every API Lambda handler must execute the tenant setting **before** performing any query inside the transaction:
```sql
SET LOCAL app.current_tenant_id = '<uuid>';
```
This is managed centrally through the `ITenantContext` port. Handlers set the context, and database adapters consume it. Raw, direct `pg` queries bypassing this port are prohibited.

## 2. Decoupled Catalog & RLS-Exempt Tables

To support crowdsourced local price comparisons and the split-route shopping optimizer, Wobblio maintains a global, RLS-exempt layer. The following tables **do not enable RLS** and are readable by all tenants:
* `merchant`, `merchant_alias`
* `product_category`, `product`, `product_alias`
* `price_observation` (The de-identified price registry)
* `fx_rate` (Exchange rates)
* `system_counter` (Atomic waitlist/user capacity registry)
* `migration_ledger`
* `limits` (Quota overrides for testing/admin roles)
* `tenant_trust` (Tenant reputation/trust weights)
* `payment_transaction` (Auditing Stripe events)
* `kpi_daily` (Daily aggregated analytics metrics)
* `admin_audit_log`

## 3. Verified Schema Drops (June 2026 Updates)

To keep the database lean and enforce YAGNI, several table schemas present in older specifications were deprecated and dropped via migrations:
1. **`merchant_branch`:** Dropped on 2026-06-21. Location-based routing was deferred. Prices and optimizations are aggregated at brand+region rather than branches.
2. **`product_concept`:** Dropped on 2026-06-22. General product concepts grouping brands (e.g. "organic semi-skimmed milk") were deferred to Phase 2.
3. **`ai_spend_ledger`:** Dropped on 2026-06-22. The daily AI-spend cap logic was removed; weekly upload quotas enforce cost boundaries instead.
4. **`tenant_signature`:** Dropped on 2026-06-22. Device and IP hashing constraints were consolidated.

## 4. Connection Management & db.t3.micro Limits

Wobblio operates on a restricted database connection budget. A standard `db.t3.micro` instance supports a ceiling of roughly 85-90 connections. Unbounded Lambda execution will exhaust this pool.

### Concurrency Rules
* **Reserved Concurrency Ceilings:**
  * API Handlers: `api-handlers` is capped at a maximum concurrency of **25**.
  * Ingestion Worker: SQS worker concurrency is limited to **5** (`maxConcurrency`).
  * Cron Lambdas: Trailing cron handlers are capped at **2**.
* **Pooling:** One database pool is created lazily per warm Lambda container and reused.
* **IAM Authentication:** IAM token authentication is used to connect, with tokens refreshed every 10 minutes to avoid the 15-minute expiration window.
* **Statement Timeouts:** Strict safety timeouts are set: `5s` statement timeout for API operations, and `30s` for background ingestion jobs.
* **Scaling Up:** Concurrency caps must not be raised without provisioning an RDS Proxy.
