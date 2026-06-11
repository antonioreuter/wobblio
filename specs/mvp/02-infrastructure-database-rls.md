# 02 — Infrastructure, Database & RLS

**Epic 3 | Phase 1 | Blocks all backend features**

## Overview

CDK multi-stack infrastructure provisioning, PostgreSQL schema with Row-Level Security, and all extensions required by the data-intelligence layer. The DB lives in its own CDK stack (stateful, slow-changing) separate from the fast-moving app stacks.

## Dependencies

- [01 — Local Development Sandbox](./01-local-development-sandbox.md)

## CDK Stack Structure

- **`WobblioDbStack`** (stateful) — RDS PostgreSQL db.t3.micro, security groups, KMS CMK, VPC config
- **`WobblioAppStack`** (fast-moving) — Lambda fleet, API Gateway, SQS queues, S3 buckets, SNS, SES, EventBridge
- **`WobblioAuthStack`** — Cognito User Pool, federated identity providers
- **`WobblioAdminStack`** (optional at launch) — Admin-specific resources

CDK synthesis is gated by `cdk-nag` — synthesis must pass nag rules before any deploy.

## Database: db.t3.micro Capacity Envelope

- 2 burstable vCPU, 1 GiB RAM, ~85 usable connections, 20 GiB gp3
- Designed for: 10k registered users, ~4k MAU, ~3k invoice ingestions/day
- CPU Unlimited mode: **OFF** (runaway queries alarm, don't silently bill)
- Scaling ladder (pre-decided, no architecture change at each step):
  1. API concurrency >20 sustained → add RDS Proxy (~€11/mo)
  2. CPU >60% or chronic credit pressure → modify to db.t4g.small (~€26/mo)
  3. Read-heavy reporting → add read replica, point reporting adapter at it

## Connection Management

- Reserved concurrency caps: api-handlers ≤ 25, ingestion worker ≤ 5 (`maxConcurrency`), crons ≤ 2
- Worst-case connections: ~32 (safely under ~85 ceiling)
- One connection per warm Lambda container, created lazily
- IAM auth tokens regenerated when >10 minutes old (tokens expire at 15 min)
- Statement timeout: 5s on API paths, 30s on workers

## PostgreSQL Extensions

- `pg_trgm` — trigram fuzzy matching for merchant/product alias lookup
- `pgvector` — 512-dim product embeddings (HNSW index)

## RLS Tenancy Pattern

```sql
-- Every API Lambda sets this before any query:
SET LOCAL app.current_tenant_id = '<uuid>';

-- RLS policies on all tenant-scoped tables:
CREATE POLICY tenant_isolation ON invoice
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

## Core Schema (Tenant-Scoped Tables, RLS-enforced)

```
app_user            (id, cognito_sub UNIQUE, email, role ENUM(STANDARD,PREMIUM,TESTER,ADMIN),
                     status ENUM(ACTIVE,STATUS_WAITLIST,DELETED), country_code, language,
                     home_currency, region_code, price_contribution_optout BOOL DEFAULT false,
                     stripe_customer_id NULL, created_at)
household           (id, owner_user_id, name, created_at)
household_member    (household_id, user_id, joined_at)
invoice             (id, tenant_id, household_id NULL, uploaded_by_user_id,
                     merchant_id NULL, branch_id NULL,
                     status ENUM(PROCESSING,NEEDS_REVIEW,PARSED,FAILED_PROCESSING,
                                 SUSPECTED_DUPLICATE,DISCARDED),
                     transaction_date, currency, total, total_home_currency,
                     fx_rate_used NULL, category_id, image_s3_key, image_sha256,
                     search_tags TEXT[],  -- GIN index
                     created_at)
invoice_line        (id, invoice_id, raw_text, product_id NULL, category_id,
                     quantity, pack_quantity NULL, base_unit NULL,
                     unit_price NULL, normalized_unit_price NULL, line_total,
                     is_discount BOOL, is_deposit_or_fee BOOL, confidence NUMERIC)
shopping_list       (id, tenant_id, name, is_active BOOL, created_at, completed_at NULL)
shopping_list_item  (id, list_id, free_text, product_id NULL, checked BOOL, position)
budget              (id, tenant_id, scope ENUM(TOTAL,CATEGORY,MEMBER),
                     category_id NULL, member_user_id NULL, amount,
                     period ENUM(WEEK,MONTH), accumulated,
                     alert_85_fired BOOL, alert_100_fired BOOL, cycle_start)
bill_split          (id, invoice_id, created_at)
bill_split_line     (split_id, line_id, participant_name_enc, fraction NUMERIC)
quota_counter       (tenant_id, counter ENUM(UPLOADS,HOUSEHOLD_UPLOADS), week_start, used)
ingestion_ledger    (s3_key PRIMARY KEY, tenant_id, status, attempt_count, created_at)
invoice_feedback    (id, invoice_id, tenant_id, verdict ENUM(UP,DOWN),
                     reason ENUM(ITEMS,MERCHANT_TOTAL,OTHER) NULL,
                     comment_enc TEXT NULL, model_ids_snapshot JSONB, created_at)
data_request        (id, tenant_id, kind ENUM(EXPORT,DELETION), status,
                     export_s3_key NULL, requested_at, completed_at NULL)
```

## Core Schema (Global Tables, No RLS)

```
merchant            (id, brand_name, country_code, default_category_id,
                     website, created_via ENUM(SEED,AUTO,ADMIN), status)
merchant_branch     (id, merchant_id, branch_label, address, city, postal_code,
                     geo_point NULL, external_store_number NULL)
merchant_alias      (id, merchant_id, branch_id NULL, alias_normalized TEXT,
                     vat_id NULL, match_count INT, last_seen_at,
                     source ENUM(SEED,AUTO_FUZZY,AUTO_LLM,USER_CONFIRMED,ADMIN))
product_category    (id, parent_id NULL, name, level SMALLINT)
product_concept     (id, name, category_id)
product             (id, concept_id NULL, category_id, brand TEXT NULL,
                     display_name, base_unit ENUM(KG,L,PIECE),
                     pack_size_base_units NUMERIC NULL,
                     embedding vector(512),
                     created_via, status)
product_alias       (id, product_id, alias_normalized, merchant_id NULL,
                     match_count, source, last_seen_at)
price_observation   (id, product_id, merchant_id, country_code, region_code,
                     observed_on DATE, pack_price NUMERIC,
                     normalized_unit_price NUMERIC, base_unit, currency,
                     was_discounted BOOLEAN, quality ENUM(AUTO,USER_CONFIRMED),
                     quarantined BOOL DEFAULT false,
                     contributor_trust_at_write SMALLINT)
fx_rate             (date, base, quote, rate)
system_counter      (name, value)  -- atomic free-user count
migration_ledger    ()
limits              (role_or_user_ref, quota_name, value)
ai_spend_ledger     (tenant_id, date, model_role, input_tokens, output_tokens, est_cost)
tenant_trust        (tenant_id, trust_score, recomputed_at)
tenant_signature    (tenant_id, device_hash, ip_prefix_hash, first_seen_at)
payment_transaction (id, user_id, stripe_event_id UNIQUE, type ENUM(...),
                     amount, currency, plan ENUM(MONTHLY,ANNUAL),
                     occurred_at, raw_payload_s3_key)
kpi_daily           (metric_date, metric_name, value NUMERIC, dimensions JSONB NULL)
```

## KMS Encryption Scope (Narrow — Preserves Queryability)

Application-level AES-GCM-256 (envelope pattern, KMS CMK) applied **only** to:
- Free-text personal notes
- Household invite tokens at rest
- Exported-report S3 URLs
- User-entered contact names in bill splitting

**NOT encrypted at application level:** amounts, merchants, products, categories, dates (these are protected by RLS + storage-level RDS encryption + IAM auth + SG rules).

---

## Checklist

### CDK Stack Definitions
- [ ] `WobblioDbStack`: RDS db.t3.micro, multi-AZ disabled (cost), storage 20 GiB gp3, automated backup 7 days, KMS CMK for storage encryption, security group allowing only Lambda SG on port 5432, IAM authentication enabled, CPU Unlimited OFF
- [ ] `WobblioAppStack`: Lambda functions (stubs), API Gateway REST API with JWT authorizer, SQS ingest queue + DLQ (maxReceiveCount 3), S3 buckets (uploads, exports, billing-archive), SNS platform applications (FCM, APNs), SES domain/email identity, EventBridge rules for crons
- [ ] `WobblioAuthStack`: Cognito User Pool, Google + Meta federation, pre-signup Lambda hook, custom attributes (role, status, waitlist position)
- [ ] cdk-nag gating on all stacks (synthesis must pass)
- [ ] Resource tagging: environment, project, owner on all resources
- [ ] `-dev`/`-prod` resource naming suffixing

### PostgreSQL Setup
- [ ] Install and enable `pg_trgm` extension
- [ ] Install and enable `pgvector` extension
- [ ] Create `app.current_tenant_id` configuration parameter
- [ ] Create all tenant-scoped tables with RLS enabled
- [ ] Create RLS policies on all tenant tables using `current_setting('app.current_tenant_id')`
- [ ] Create all global (no-RLS) tables
- [ ] Create `system_counter` row for free-user atomic count

### Indexes
- [ ] `merchant_alias`: unique index on `(alias_normalized, country_code)`; GIN trgm index on `alias_normalized`
- [ ] `product_alias`: trgm index on `alias_normalized`
- [ ] `product`: HNSW pgvector index on `embedding` (512-dim, cosine)
- [ ] `price_observation`: composite index on `(product_id, merchant_id, region_code, observed_on)`
- [ ] `invoice`: GIN index on `search_tags`
- [ ] `payment_transaction`: unique index on `stripe_event_id`
- [ ] `kpi_daily`: primary key on `(metric_date, metric_name, dimensions)`

### Migration Framework
- [ ] Choose migration tool (e.g., Flyway, node-pg-migrate, or custom)
- [ ] Initial migration: schema creation, extensions, all tables
- [ ] Migration ledger table for tracking applied migrations
- [ ] CI step: run migrations against dev before any deploy

### S3 Buckets
- [ ] `wobblio-uploads-{env}`: presigned PUT uploads, object lifecycle (delete images after 18 months per GDPR)
- [ ] `wobblio-exports-{env}`: GDPR data exports, 7-day lifecycle delete, access-logged
- [ ] `wobblio-billing-archive-{env}`: Stripe webhook payloads, Standard → Glacier IR at 90 days, retain 7 years
- [ ] `wobblio-analytics-{env}`: KPI Parquet exports, Glue table definition

### Connection Management
- [ ] Reserved concurrency configured per function group in CDK
- [ ] SQS `maxConcurrency: 5` on ingestion worker event source
- [ ] Lambda connection-reuse pattern: one connection per warm container, lazy init
- [ ] IAM token refresh logic: regenerate if token age >10 min
- [ ] Statement timeout: 5s API, 30s workers (set via `SET LOCAL statement_timeout`)

### KMS Field Encryption
- [ ] KMS CMK created in `WobblioDbStack`
- [ ] Envelope encryption helper (encrypt/decrypt using CMK data key)
- [ ] Applied to: `bill_split_line.participant_name_enc`, `invoice_feedback.comment_enc`, `data_request.export_s3_key`, personal notes column
