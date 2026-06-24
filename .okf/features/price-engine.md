---
type: Feature Specification
title: Anti-Inflation Price Engine & Split-Route Optimizer
description: The de-identified price observation store, unit-price normalization, and greedy split-route list optimization.
tags: [features, price-engine, optimizer, math]
timestamp: 2026-06-23T21:55:00Z
---

# Anti-Inflation Price Engine & Split-Route Optimizer

The core value proposition of Wobblio rests on turning unstructured receipt captures into a regional, crowdsourced price index. This index powers both historical price trends and the shopping route optimizer.

## 1. The Price Observation Store

To gather price data across tenants without compromising privacy or violating database Row-Level Security (RLS), Wobblio uses a completely separate, un-isolated table:

```sql
CREATE TABLE price_observation (
  id                        UUID              PRIMARY KEY,
  product_id                UUID              NOT NULL REFERENCES product(id),
  merchant_id               UUID              NOT NULL REFERENCES merchant(id),
  country_code              CHAR(2)           NOT NULL,
  region_code               TEXT              NOT NULL, -- First 2 digits of postal code (coarsened)
  observed_on               DATE              NOT NULL, -- Day-precision only
  pack_price                NUMERIC(10,4)     NOT NULL,
  normalized_unit_price     NUMERIC(10,4)     NOT NULL,
  base_unit                 product_base_unit NOT NULL, -- KG, L, PIECE
  currency                  CHAR(3)           NOT NULL,
  was_discounted            BOOLEAN           NOT NULL DEFAULT false,
  quality                   price_obs_quality NOT NULL DEFAULT 'AUTO',
  quarantined               BOOL              NOT NULL DEFAULT false,
  contributor_trust_at_write SMALLINT         NOT NULL  -- Copied from tenant reputation
);
```

### De-identification Rules
* **Coarsening:** Geography is reduced to regional postal prefixes; dates are daily-granular (removing timestamps).
* **Isolation:** The table contains no columns pointing to the user, household, or source invoice.
* **Privacy:** A $k$-threshold is applied at query time. The comparison charts only render a merchant/product/region data point if $\ge 3$ distinct observations exist in the window.

## 2. Unit-Price Normalization

Comparisons require that unit sizes normalize into a standard base metric (`KG`, `L`, or `PIECE`):
1. **Printed Size Parsing:** Multipacks are multiplied (e.g. `6X33CL` $\rightarrow$ `1.98 L`). Weight-priced items capture the raw weight (e.g., `0.482 KG`).
2. **Standardization:**
   $$\text{Normalized Unit Price} = \frac{\text{Line Total}}{\text{Quantity} \times \text{Pack Size Base Units}}$$
3. **Mismatches:** If sizes cannot be parsed, no price observation is emitted. Comparisons never cross different base units.

## 3. Split-Route Shopping Optimizer

The split-route optimizer partitions a shopping list among local stores to maximize savings:

1. **Price Matrix Construction:** Built by querying `price_observation` for the product IDs on the shopping list against candidate merchants in the user's region.
2. **Single-Store Baseline:** Computes the total cost of buying everything at a single store (using the user's historical average price to fill missing cells).
3. **Unconstrained Minimum:** The sum of the lowest price for each item across all candidate stores.
4. **Partition Heuristic:** If the unconstrained minimum saves more than a threshold set in SSM (`/wobblio/config/routing/min_split_saving`, default $\text{€}5.00$) over the baseline:
   * Greedily split the list into at most **3** stores.
   * If a sub-list's marginal saving falls below $\text{€}1.50$, merge it back into the primary store's list.
5. **Output:** Per-store sub-lists with line expected prices, expected total savings, and data confidence (observation count and age).

## 4. Catalog Curation & The Quorum Promotion System

To protect the shared product/merchant catalogs and the price index from malicious pollution or spam, Wobblio enforces a **quarantine-by-default** model. Provisional data is only promoted to the public global view after meeting strict verification criteria.

### 1. Provisional Visibility (Quarantine)
When a merchant or product is auto-created by the ingestion worker, it is assigned a `PROVISIONAL` status:
* **Quarantined Observations:** Any price observations written to `price_observation` for a provisional entity are marked `quarantined = true` and are excluded from the global comparison engine.
* **Pre-Quorum Serving:** Because raw receipt scans are saved in RLS-protected tenant tables, the contributing user can view, list, and budget with their own provisional items immediately. Their personal history page bypasses the quorum checks entirely, ensuring immediate utility.

### 2. Sybil-Gated Promotion Quorum
A provisional entity transitions to `ACTIVE` (making it visible globally and un-quarantining its observations) only through:
1. **Manual Admin Curation:** Approval via the Admin Console curation queue.
2. **Organic Quorum Promotion:** Gathering corroboration scans from $\ge 3$ distinct **eligible corroborators** (or $\ge 2$ user-confirmed aliases).

### 3. Eligible Corroborator Rules
To prevent Sybil attacks (where a malicious user creates multiple accounts to artificially promote items), a tenant is counted as an eligible corroborator only if they satisfy:
* **Account Age:** The account must be $\ge 7$ days old.
* **Activity:** The tenant must have $\ge 5$ successfully parsed invoices.
* **Reputational Trust:** The tenant's trust score (stored in `tenant_trust`) must be $\ge 30$ (default is 20; low-trust quarantine floor is 10).
* **Device/Network Signature:** The salted hash of the device identifier and IP prefix captured during receipt upload must be unique. Multiple accounts on a single phone or local network only count as one corroboration.

### 4. Coordinated Collusion Detectors
Two automated detectors run during ingestion to intercept coordinated attacks, voiding corroboration and flagging the account cluster for admin review:
* **Cross-Tenant Image-Hash Collision:** The same image SHA-256 uploaded by multiple distinct tenants (honest users never share raw photo bytes).
* **Cross-Tenant Fingerprint Collision:** The same parsed values `(merchant, date, total)` uploaded by multiple *new* accounts in a short time frame (receipt recycling). *Note: household members sharing receipts are exempt.*

### 5. Gate 2: Read-Time $k$-Threshold
Even after a product and merchant are promoted to `ACTIVE` (and their price observations are un-quarantined), a coarse region-cell must still satisfy **Gate 2**:
* The Anti-Inflation engine only displays a price in comparisons or splits if there are **$k \ge 3$** distinct observations within the regional postal prefix in the trailing window. This prevents individual shoppers in low-density areas from being re-identified by their public price footprint.

