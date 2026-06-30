---
type: Operations Guide
title: Testing Strategy & Scenarios
description: Architectural test levels (Unit, Integration, E2E, Validation Stacks) and step-by-step verification scenarios for core business invariants.
tags: [operations, runbooks, testing, qa, vitest, playwright]
timestamp: 2026-06-30T23:30:00Z
---

# Testing Strategy & Scenarios

Wobblio employs a layered testing strategy to ensure that core business logic, database isolation boundaries, external API integrations, and user interfaces remain correct, reliable, and decoupled.

---

## 1. Test Levels & Tooling

```
  ┌────────────────────────────────────────────────────────┐
  │         E2E Tests (Playwright / Browser Automation)     │
  ├────────────────────────────────────────────────────────┤
  │    Integration Tests (LocalStack / Postgres Adapters)  │
  ├────────────────────────────────────────────────────────┤
  │      Unit Tests (Vitest 2.0 / Mock-Isolated Ports)     │
  └────────────────────────────────────────────────────────┘
```

### 1.1 Unit Tests (Vitest 2.0)
* **Scope:** 100% of the core domain layer (`src/core/services/` and `src/core/domain/`).
* **Isolation:** The domain layer is strictly isolated. All Ports (TypeScript interfaces) are stubbed or mocked entirely. Unit tests do not perform database connections, S3 uploads, or AWS Bedrock calls.
* **Command:** `npm run test:unit`

### 1.2 Integration Tests (Postgres + LocalStack)
* **Scope:** Concrete adapters (`src/infrastructure/adapters/`) and database repository implementations.
* **Sandbox:** Executes locally using Dockerized PostgreSQL and LocalStack (simulating S3, SQS, and SSM) to avoid AWS charges.
* **Focus:** Confirms database triggers, RLS policies, vector similarity queries, and SQS queue consumer transitions.
* **Command:** `npm run test:integration`

### 1.3 End-to-End (E2E) Tests (Playwright)
* **Scope:** Full-stack user workflows (Auth $\rightarrow$ Capture $\rightarrow$ Ingestion worker $\rightarrow$ Dashboard updates).
* **Execution:** Playwright automates standard browser actions. Tests run against the local staging stack, using test-tenant data seeded before each scenario and mocking external Stripe webhooks. Uses `data-testid` properties to target DOM elements.
* **Command:** `npm run test:e2e`

---

## 2. Main Test Case Scenarios

### Scenario A: Quota & Credit Soft-Cap Enforcement
Verifies that AI credits are monitored correctly without blocking the processing of the user's final weekly invoice.
* **Setup:**
  - Create a `STANDARD` tenant with a weekly cap of 30,000 credits.
  - Set parameter `/config/quotas/average_tokens_per_invoice` to 10,000.
* **Test Sequence:**
  1. **Upload 1 (Under Cap):** Set current usage to 0 credits. Request a presigned URL (`POST /invoices/presign`). Verify it returns a valid URL.
  2. **Upload 2 (Under Cap):** Simulate ingestion consumption of 25,000 credits. Current usage is now 25,000. Request a second presigned URL. Verify it is **approved** (since `25,000 < 30,000` is true, verifying the soft-cap allowance).
  3. **Ingest (Over Cap):** Ingestion worker processes the second receipt and consumes 10,000 credits. DB increments the usage to 35,000 credits.
  4. **Upload 3 (Over Cap Block):** Request a third presigned URL. Verify the API rejects the request immediately with a `429 QuotaExceededError`.
  5. **Failure Refund Check:** Set usage back to 25,000. Request upload (approved). Force ingestion worker to fail processing. Verify that **zero credits are charged** and the user's counter remains at 25,000.

---

### Scenario B: Household Quotas & Membership Transitions
Ensures credits are conserved and never generated/destroyed when users enter, leave, or dissolve households mid-week.
* **Setup:**
  - Create Owner (Premium, `50,000 / 100,000` credits used).
  - Create Member (Standard, `20,000 / 30,000` credits used).
* **Test Sequence:**
  1. **Member Joins:** Owner creates a household and Member joins.
     - *Assert:* `HOUSEHOLD_CREDITS` pool is initialized to `50,000` (Owner's usage). Cap is `150,000` (Household cap).
     - *Assert:* Member's personal usage counter is set aside (`20,000`), not merged. Member uploads now count against the household pool.
  2. **In-Household Upload:** Member uploads a receipt that consumes 15,000 credits.
     - *Assert:* `HOUSEHOLD_CREDITS` increments to `65,000`. Member's set-aside personal counter remains at `20,000`.
  3. **Member Leaves:** Member leaves the household.
     - *Assert:* Member's personal counter resumes at `20,000 / 30,000` (Standard cap restored).
     - *Assert:* Household pool remains at `65,000` (credits spent stay in the owner's pool).
  4. **Household Dissolution:** Owner dissolves the household.
     - *Assert:* Owner's personal counter becomes `65,000 / 100,000` (computed as `GREATEST(50,000 personal, 65,000 household)`).
  5. **Anti-Exploitation Churn Block:** Attempt to make a user join/leave a household 4 times within a single calendar week.
     - *Assert:* The 4th join attempt must throw a `HouseholdChurnLimitError` and emit a warning log.

---

### Scenario C: Ingestion Pipeline & Arithmetic Sanity
Verifies raw OCR conversion, deduplication, and quality fallback flags.
* **Test Sequence:**
  1. **Schema Failures:** Pass an unparseable, malformed JSON string from the mock Bedrock parser.
     - *Assert:* The ingestion worker retries the parsing call exactly once. If it fails again, the message is routed to the DLQ.
  2. **Arithmetic Mismatches:** Set line items sum to €10.00 and the invoice total to €15.00.
     - *Assert:* The mismatch ($>€0.05$) triggers status `NEEDS_REVIEW`.
  3. **Exact Duplicates:** Upload an image with a SHA-256 hash matching an existing invoice under the same tenant.
     - *Assert:* The upload is blocked at the presign step with a `409 Conflict`.
  4. **Fuzzy Duplicates:** Upload a receipt from a different angle (new SHA-256) but matching `(merchant_id, transaction_date, total, line_count)`.
     - *Assert:* Ingestion worker saves the record but flags status as `SUSPECTED_DUPLICATE` (requiring user confirmation). No price observations are emitted.

---

### Scenario D: Catalog Quarantine & Price Plausibility
Tests protection layers against catalog poisoning.
* **Test Sequence:**
  1. **Provisional Isolation:** Upload an invoice containing a new product.
     - *Assert:* Product is created with status `PROVISIONAL`.
     - *Assert:* The contributing tenant can see and query this product immediately (e.g. in lists).
     - *Assert:* Other tenants cannot search for or view this product in autocomplete.
  2. **Promotion Quorum:** Seed observations for the provisional product from 3 distinct *eligible* tenants.
     - *Assert:* Product status is promoted to `ACTIVE`, and it becomes globally visible.
  3. **Sybil Resistance:** Seed observations from 3 accounts sharing the same device/IP signature.
     - *Assert:* Quorum verification rejects the promotion.
  4. **Price Plausibility:** Attempt to emit a price observation of €50.00 for a product with a 90-day regional median of €2.00.
     - *Assert:* The €50.00 observation ($> \text{median} \times 4$) is flagged as `quarantined = true` and is excluded from aggregate indexes.

---

### Scenario E: GDPR Data Lifecycle
Verifies compliance with Article 17 (erasure) and Article 20 (portability).
* **Test Sequence:**
  1. **Data Export:** Trigger `POST /me/export`.
     - *Assert:* An SQS export event is generated.
     - *Assert:* A ZIP archive is generated containing CSV tables and raw receipt images, saved in the exports bucket with a 7-day TTL.
  2. **Two-Phase Deletion:** Trigger `DELETE /me/profile`.
     - *Assert:* Account status is flipped to `DELETED`, and Cognito access is revoked.
     - *Assert:* After 30 days, the purge worker hard-deletes all RDS tenant rows and S3 image objects.
     - *Assert:* Anonymized price observations are preserved in the shared store.
     - *Assert:* Payment transaction entries are retained for 7 years, but the `user_id` is replaced with an opaque token.

---

### Scenario F: Stripe Webhook Ingest
Verifies transactional payment hooks.
* **Test Sequence:**
  1. **Duplicate Webhooks:** Send two identical webhook event payloads (`checkout.session.completed`) with the same event ID.
     - *Assert:* The first event upgrades the user to `PREMIUM`. The second event is rejected silently by the database's unique event ID constraint (ensuring idempotency).
  2. **Payment Failure Grace Period:** Trigger `invoice.payment_failed` on a Premium account.
     - *Assert:* Account status transitions to a payment failure grace state.
     - *Assert:* User retains Premium access for 7 days, and a card update banner is displayed.
     - *Assert:* If unpaid after 7 days, the cron worker downgrades the role to `STANDARD`.

---

## 3. Code Quality Assurance & cdk-nag Compliance

Wobblio enforces automated quality gates and structural constraints during linting, compiling, and cloud resource synthesis to guarantee codebase hygiene and security.

### 3.1 Static Code Quality Gates
* **Hexagonal Architecture Validator:** A custom static analysis script (`npm run skill:hexagonal-architecture-validator`) scans TypeScript imports. It blocks dependency leaks pointing from `src/core/` services to outer infrastructure layers (adapters, handlers, or raw AWS SDKs). Violations cause local checks and GitHub Actions CI pipelines to fail.
* **Security & GDPR Leak Auditor:** Runs static check queries (`npm run validate:security`) verifying that database definitions enforce Row-Level Security (RLS) policies and that no high-PII data fields leak outside the KMS envelope encryption boundaries.
* **Strict Type Safety:** TypeScript compiler flags (`strict: true`, `noImplicitAny: true`) are enforced in the shared `tsconfig.json` to prevent runtime regressions and force explicit domain interfaces.

### 3.2 Infrastructure Security Audits via cdk-nag
To prevent cloud misconfigurations and check compliance against security frameworks, Wobblio integrates **cdk-nag** (using AWS Solutions rulesets) directly into the AWS CDK synthesis pipeline:
* **Synthesis Hook:** When running `npm run cdk:synth` (during local deployment or CI validation checks), the `cdk-nag` aspect runs automatically over all stacks.
* **Enforced Controls:**
  - Blocks deployment of S3 buckets without explicit Server-Side Encryption (SSE) or public access blocks.
  - Flags wildcard permissions (`*` action or `*` resource) on IAM policies.
  - Ensures Cognito user pools require strict password complexity settings.
  - Validates that Lambdas inside VPCs are not mapped to public subnets.
* **Violation Strategy:** Any warning or error thrown by `cdk-nag` immediately aborts the synthesis process and halts the deployment pipeline.
* **Suppression Rule Invariant:** If a warning represents an acceptable risk (e.g. an S3 bucket used for public assets that requires read permissions), the developer must write a targeted suppression block directly in the CDK stack with a detailed justification parameter:
  ```typescript
  NagSuppressions.addResourceSuppressions(myBucket, [
    {
      id: 'AwsSolutions-S2',
      reason: 'This bucket is explicitly designed to host public web application assets (images, logos) and thus public read access is required.'
    }
  ]);
  ```

