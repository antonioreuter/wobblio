---
type: Database Reference
title: Database Schema & Entities
description: Detailed entity schemas, relations, field encryption scopes, and de-identification boundaries.
tags: [database, postgres, schema, entities, encryption]
timestamp: 2026-06-30T22:51:00Z
---

# Database Schema & Entities

Wobblio organizes its database layer into **Tenant-Scoped Tables** isolated using PostgreSQL Row-Level Security (RLS) and **Global (RLS-Exempt) Tables** containing shared catalog details and crowdsourced market indices.

---

## 1. Entity Relationship Diagram

```mermaid
erDiagram
    APP_USER ||--o{ INVOICE : "uploads / owns"
    APP_USER ||--o{ SHOPPING_LIST : "manages"
    APP_USER ||--o{ BUDGET : "defines"
    APP_USER ||--o{ QUOTA_COUNTER : "consumes"
    APP_USER ||--o{ HOUSEHOLD : "owns / creates"
    
    HOUSEHOLD ||--o{ HOUSEHOLD_MEMBER : "contains"
    HOUSEHOLD ||--o{ BILL_SPLIT : "tracks (via members)"
    HOUSEHOLD_MEMBER ||--o{ BILL_SPLIT_LINE : "allocates"
    
    INVOICE ||--o{ INVOICE_LINE : "contains"
    INVOICE ||--o{ INVOICE_FEEDBACK : "receives"
    INVOICE_LINE ||--o{ BILL_SPLIT_LINE : "links to"
    
    MERCHANT ||--o{ MERCHANT_ALIAS : "has aliases"
    MERCHANT ||--o{ INVOICE : "supplies"
    
    PRODUCT_CATEGORY ||--o{ PRODUCT : "classifies"
    PRODUCT ||--o{ PRODUCT_ALIAS : "has aliases"
    PRODUCT ||--o{ INVOICE_LINE : "resolves"
    PRODUCT ||--o{ PRICE_OBSERVATION : "tracks prices"
    
    PRICE_OBSERVATION {
        date observation_date
        string region_postal_prefix
        numeric unit_price
        numeric quantity
    }
```

---

## 2. Tenant-Scoped Entities (RLS Enforced)

All tables below enable Row-Level Security and filter on the session parameter `app.current_tenant_id`. For personal tables, the tenant is the `user_id`. For household-pooled features (e.g. shopping lists, bill splits), the tenant maps to the `household_id`.

### 2.1 app_user
Represents the individual user account. The role column determines functional quotas and access levels.
* `id` (UUID, PK)
* `cognito_sub` (VARCHAR UNIQUE) — Link to AWS Cognito Identity Provider.
* `email` (VARCHAR)
* `role` (ENUM: `STANDARD`, `PREMIUM`, `TESTER`, `ADMIN`)
* `status` (ENUM: `ACTIVE`, `STATUS_WAITLIST`, `DELETED`)
* `country_code` (VARCHAR) — e.g. "NL".
* `language` (VARCHAR) — e.g. "nl".
* `home_currency` (VARCHAR) — e.g. "EUR".
* `region_code` (VARCHAR) — Regional postal prefix subdivision.
* `price_contribution_optout` (BOOLEAN DEFAULT false) — Allows opt-out of price aggregation.
* `stripe_customer_id` (VARCHAR, NULL)
* `created_at` (TIMESTAMP)

### 2.2 household & household_member
Defines shared household groupings.
* **household:**
  * `id` (UUID, PK)
  * `owner_user_id` (UUID, FK app_user)
  * `name` (VARCHAR) — Encrypted at rest (AES-GCM).
  * `created_at` (TIMESTAMP)
* **household_member:**
  * `household_id` (UUID, FK household, PK)
  * `user_id` (UUID, FK app_user, PK)
  * `joined_at` (TIMESTAMP)

### 2.3 invoice & invoice_line
Stores structured receipt metrics extracted from S3 images.
* **invoice:**
  * `id` (UUID, PK)
  * `tenant_id` (UUID) — The owning user or household tenant.
  * `household_id` (UUID, FK household, NULL)
  * `uploaded_by_user_id` (UUID, FK app_user)
  * `merchant_id` (UUID, FK merchant, NULL)
  * `status` (ENUM: `PROCESSING`, `NEEDS_REVIEW`, `PARSED`, `FAILED_PROCESSING`, `SUSPECTED_DUPLICATE`, `DISCARDED`)
  * `transaction_date` (DATE)
  * `currency` (VARCHAR)
  * `total` (NUMERIC)
  * `total_home_currency` (NUMERIC)
  * `fx_rate_used` (NUMERIC, NULL)
  * `category_id` (UUID, FK product_category)
  * `image_s3_key` (VARCHAR)
  * `image_sha256` (VARCHAR)
  * `search_tags` (TEXT[]) — Up to 3 vocabulary tags, GIN-indexed.
  * `created_at` (TIMESTAMP)
* **invoice_line:**
  * `id` (UUID, PK)
  * `invoice_id` (UUID, FK invoice)
  * `raw_text` (VARCHAR)
  * `product_id` (UUID, FK product, NULL)
  * `category_id` (UUID, FK product_category)
  * `quantity` (NUMERIC)
  * `pack_quantity` (NUMERIC, NULL)
  * `base_unit` (VARCHAR, NULL) — e.g. "KG", "L", "PIECE".
  * `unit_price` (NUMERIC, NULL)
  * `normalized_unit_price` (NUMERIC, NULL) — Calculated unit rate.
  * `line_total` (NUMERIC)
  * `is_discount` (BOOLEAN)
  * `is_deposit_or_fee` (BOOLEAN)
  * `confidence` (NUMERIC) — LLM parse confidence score.

### 2.4 budget
Defines user-established spending limits.
* `id` (UUID, PK)
* `tenant_id` (UUID)
* `scope` (ENUM: `TOTAL`, `CATEGORY`, `MEMBER`)
* `category_id` (UUID, FK product_category, NULL)
* `member_user_id` (UUID, FK app_user, NULL)
* `amount` (NUMERIC)
* `period` (ENUM: `WEEK`, `MONTH`)
* `accumulated` (NUMERIC) — Aggregated spending in currency.
* `alert_85_fired` (BOOLEAN)
* `alert_100_fired` (BOOLEAN)
* `cycle_start` (DATE)

### 2.5 bill_split & bill_split_line
Proportional receipt splitting entries.
* **bill_split:**
  * `id` (UUID, PK)
  * `invoice_id` (UUID, FK invoice)
  * `created_at` (TIMESTAMP)
* **bill_split_line:**
  * `split_id` (UUID, FK bill_split, PK)
  * `line_id` (UUID, FK invoice_line, PK)
  * `participant_name_enc` (VARCHAR) — Participant name encrypted with KMS.
  * `fraction` (NUMERIC) — Share ratio (e.g. 0.50).

---

## 3. Global Entities (RLS Exempt)

Shared tables readable by all authenticated tenants. They form the canonical catalog and regional index.

### 3.1 merchant & merchant_alias
* **merchant:** `id` (UUID, PK), `name` (VARCHAR), `default_category_id` (UUID, FK product_category, NULL), `status` (ENUM: `PROVISIONAL`, `ACTIVE`), `created_at`.
* **merchant_alias:** `id` (UUID, PK), `merchant_id` (UUID, FK merchant), `alias_normalized` (VARCHAR UNIQUE), `vat_id` (VARCHAR, NULL).

### 3.2 product & product_alias
* **product:** `id` (UUID, PK), `category_id` (UUID, FK product_category), `brand` (VARCHAR), `display_name` (VARCHAR), `embedding` (VECTOR(512), Titan V2), `status` (ENUM: `PROVISIONAL`, `ACTIVE`).
* **product_alias:** `id` (UUID, PK), `product_id` (UUID, FK product), `merchant_id` (UUID, FK merchant), `raw_name_normalized` (VARCHAR UNIQUE).

### 3.3 price_observation
The crowdsourced price registry. It tracks unit costs over geographic regions.
* `id` (UUID, PK)
* `product_id` (UUID, FK product)
* `merchant_id` (UUID, FK merchant)
* `observation_date` (DATE)
* `unit_price` (NUMERIC)
* `quantity` (NUMERIC)
* `normalized_unit_price` (NUMERIC)
* `region_postal_prefix` (VARCHAR) — Truncated postal code (e.g. "52" or "10").
* `quarantined` (BOOLEAN DEFAULT false) — Flagged anomalies.
* `contributor_trust_at_write` (SMALLINT) — Trust rating of the contributor tenant.

---

## 4. Encryption & GDPR Boundaries

### 4.1 Application-Level Encryption (KMS Envelope)
To protect personal identifiable information (PII) while ensuring database indexes and aggregations remain fast and queryable, field-level encryption is strictly isolated. 

We use **AES-GCM-256** (with AWS KMS Customer Managed Keys) on a narrow, explicit list of text columns. The database never sees the plaintext for:
1. **`household.name`**: User-defined name of the household space.
2. **`bill_split_line.participant_name_enc`**: Names of friends/family added for splits.
3. **`data_request.export_s3_key`**: S3 location of exported GDPR zip packages.
4. **`invoice_feedback.comment_enc`**: Direct comments submitted by tenants.
5. **Invite Tokens**: Tokens used to join households at rest.

Financial metrics (totals, unit prices), dates, and canonical catalog names are **never** encrypted. This permits fuzzy searches, category spend aggregation, and region-based pricing indexes without decrypting data server-side.

### 4.2 De-identification Boundary (Price Observations)
By design, the crowdsourced `price_observation` layer contains **no connection** to the contributing user, household, or specific invoice transaction. 
* Personal invoice rows link to products and merchants.
* The `price_observation` store receives a copies of these rows, but strips the `invoice_id`, `tenant_id`, `uploaded_by_user_id`, and `created_at` fields.
* Dates are truncated to calendar-day precision, and locations are truncated to the first 2 characters of the postal code subdivision (e.g. `52` instead of `5231 BA`).
* This isolation prevents re-identification, meaning the crowdsourced database remains GDPR-compliant even if a contributing user deletes their account (as the price data contains zero personal information).
