# PROJECT WOBBLIO — REVISED ENGINEERING & PRODUCT SPECIFICATION (v2.4)

**Status:** Implementation-ready. This document supersedes all prior versions (v1–v2.3). It incorporates the full review of the original specification: business model corrections, resolved inconsistencies, the previously missing data-intelligence layer (merchant canonicalization, product normalization, classification, price comparison), the corrected architecture, a revised epic backlog, and UI layout guidelines.

---

## SECTION 0 — REVIEW SUMMARY & DECISIONS LOG

This section records what was reviewed, what was found, and what changed. Everything after Section 0 is the corrected specification itself.

### 0.1 Verdict on the original document

The architectural skeleton of v1 is sound and is retained: hexagonal (ports & adapters) topology, fully serverless AWS stack provisioned via CDK in TypeScript, presigned-URL upload to S3 with SQS-decoupled asynchronous AI parsing, PostgreSQL with Row-Level Security for tenant isolation, SSM Parameter Store for runtime model configuration, and a strict low-cost posture (single burstable RDS instance, default VPC with hardened security groups, IAM token authentication, KMS-backed field encryption).

The product vision is also retained: AI receipt capture as the data acquisition mechanism, and a crowdsourced local price intelligence layer as the differentiating asset. The two flagship features — the Anti-Inflation Price Engine and the Split-Route Shopping Optimizer — are what make Wobblio more than "another expense tracker," and the entire revised specification is organized to make those two features actually buildable.

### 0.2 Critical findings and their resolutions

**Finding 1 — Missing payments implementation.** The financial model assumed Stripe fees, but no epic implemented billing. *Resolution:* New Epic 12 (Section 9) specifies Stripe Checkout + Billing with webhook-driven tier transitions, integrated with the waitlist bypass flow.

**Finding 2 — Mobile in-app purchase economics ignored.** Selling the subscription inside the iOS/Android apps incurs a 15–30% platform commission, not Stripe's ~3%. *Resolution:* Subscriptions are sold exclusively through the web checkout (Stripe). The mobile apps deep-link to the web upgrade page where store policies permit, and otherwise display a neutral "manage your plan on the web" screen. The financial model (Section 3) now carries this assumption explicitly.

**Finding 3 — Fixed payment fee destroys monthly-plan margin.** €0.25 fixed fee on a €2.50 charge is 10% before the percentage fee. *Resolution:* An annual plan (€25/year, "2 months free") becomes the promoted default. Monthly remains available. The model shows both.

**Finding 4 — Unrealistic 20% premium conversion.** Freemium B2C utilities convert at 2–5%. *Resolution:* The pro-forma now models a 4% base case, a 10% optimistic case, and retains the original 20% only as a stretch scenario. Break-even analysis added.

**Finding 5 — RLS multi-tenancy contradicts the crowdsourced price engine.** RLS prevents any tenant from reading other tenants' rows, yet price comparison requires cross-tenant aggregation. *Resolution:* Section 6.5 introduces the **Price Observation Store** — an anonymized, tenant-stripped table populated by the ingestion pipeline, exempt from RLS, keyed only by canonical product, canonical merchant, region, and date. Personal invoice data remains fully isolated; only de-identified price points cross the tenant boundary.

**Finding 6 — The data-intelligence layer did not exist.** No specification for merchant canonicalization, product normalization, categorization, unit-price normalization, or deduplication — all prerequisites for the flagship features. *Resolution:* Section 6 (the largest new section) specifies all five pipelines end to end, including data model, algorithms, LLM prompt contracts, confidence thresholds, and human-in-the-loop correction.

**Finding 7 — Quota inconsistencies.** Household pool (20/week for ≤5 members) was lower than the sum of individual premium quotas (10/week each); free reporting was described inconsistently ("invoice types" vs. categories). *Resolution:* Quota matrix unified in Section 2.4. Household pooling rule defined: the household pool is **additive on top of** personal quotas for personal invoices; invoices uploaded *into the household space* draw from the pool. Free reporting defined as "totals by top-level category, current and previous month only."

**Finding 8 — Lambda ↔ RDS connection exhaustion.** db.t3.micro allows roughly 80–90 connections; unbounded Lambda concurrency will exhaust them, and per-invocation IAM token generation adds latency. *Resolution:* Section 7.3 mandates reserved/provisioned concurrency ceilings per function, a shared connection-reuse pattern (one connection per warm container, lazy IAM token refresh before the 15-minute expiry), and names RDS Proxy as the designated scale-up step when sustained concurrency exceeds the safe ceiling — a budgeted, deliberate upgrade rather than a day-0 cost.

**Finding 9 — No idempotency or deduplication.** SQS is at-least-once; users re-photograph the same receipt; both silently corrupt budgets and the price store. *Resolution:* Section 6.6 specifies idempotency keys on the consumer and a two-layer duplicate detector (exact image hash + fuzzy invoice fingerprint).

**Finding 10 — No GDPR/data-lifecycle epic despite a "data sovereignty" pitch.** *Resolution:* New Epic 13 covers consent, export (Art. 20), erasure (Art. 17) including the de-identification boundary with the price store, retention schedules, and processor inventory.

**Finding 11 — No observability or cost-control epic despite explicit fear of runaway token costs.** *Resolution:* New Epic 14 covers structured logging, tracing, CloudWatch alarms, AWS Budgets alerts, per-model token metering, and a per-tenant AI spend ledger.

**Finding 12 — Minor corrections.** Bedrock model identifiers are treated as opaque SSM values (the named models will age; the admin console swaps them live — this is already well designed, keep it). The 85%/100% budget alert needed a definition of which date attributes spend to a budget period: **the invoice's transaction date**, falling back to upload date when unparseable. Backdated invoices that land in a closed period do not re-fire alerts.

### 0.3 What was explicitly kept unchanged

Single-tier premium pricing at €2.50/month (with the new annual option), the four-role hierarchy, the waitlist capacity guardrail, Cognito with Google/Meta federation, Flutter mobile + Next.js web split, LocalStack development sandbox, CDK multi-stack isolation, cdk-nag synthesis gating, RLS enforcement pattern via `SET LOCAL`, KMS application-level field encryption (with a narrowed field list — see 7.5), and the Day-0 public-subnet guardrails.

### 0.4 Changelog v2.0 → v2.1 (review remarks incorporated)

**R-1 Catalog poisoning.** The shared merchant/product catalog and price store are now protected by a four-layer integrity model: provisional-visibility quarantine, statistical price plausibility filtering, per-tenant trust scoring, and entity-creation velocity limits — §6.8 (new).

**R-2 Cost ceiling on t3.micro.** All instance references corrected from t4g.micro to the actually-running **db.t3.micro**. A new explicit capacity envelope (§7.3.1) states the user/throughput limits the current hardware supports, wires those limits into the SSM caps, and defines a three-step scaling ladder requiring zero architectural change.

**R-3 User feedback loop.** Thumbs-up/down on every processed invoice, persisted, fed into quality KPIs, trust scoring, and de-identified model-evaluation sets — §6.9 (new).

**R-4 GDPR export & deletion.** Epic 13 amended: exports are fully asynchronous (SQS worker → ZIP in a dedicated S3 exports bucket → push/email notification → 7-day presigned download URL); deletion is a two-phase workflow (immediate soft-lock, 30-day hard purge) retaining only legally required audit and tax records.

**R-5 Open decisions resolved.** Every item previously left open in the final section is now decided under the stated constraints (minimal budget, managed/serverless, minimal ops, incremental scale) — §12.1.

**R-6 Monitoring from day one.** Epic 14 expanded into a concrete dashboard and alarm inventory covering ingestion, OCR, Lambda, SQS, API Gateway, RDS, S3, auth, and export jobs, all routed to an SNS ops topic with email delivery — §11.1.

**R-7 Business KPIs.** A full KPI catalog (user, subscription, invoice, operational) with a low-cost implementation: nightly aggregation into a `kpi_daily` table, admin dashboard charts, and monthly Parquet export to S3 for Athena trend analysis — §11.2.

**v2.2 — Catalog-integrity review round.** Three clarifications/fixes to §6.8 following review: (1) quarantine is explicitly a property of the global layer only — the contributing user's invoice is never held, never `PENDING`, and their own lists, budgets, reports, and personal price history work from the first observation; (2) the promotion quorum is now Sybil-resistant: corroborators must meet eligibility criteria (account age, activity, trust, distinct device/network signatures), and cross-tenant image-hash or fingerprint collisions void corroboration and flag the account cluster; (3) an explicit statement of the bounded blast radius if all defenses are somehow beaten. Cross-tenant hash checking added to §6.6.

**v2.3 — Decision-model documentation & marketing brief.** (1) The catalog promotion/quarantine decision model is now formally documented as **Appendix A**: a state machine, a single-page decision table, and seven worked scenario examples covering the honest long tail, organic promotion, the 3-fake-accounts attack, the funded attacker, households, OCR garbage, and price outliers — the canonical reference so the rationale is never lost. (2) New **Section 13**: six marketing personas with pains, hooks, and feature mapping, plus a complete landing-page content brief (sections, copy direction, headline candidates, FAQ, dynamic waitlist behavior) feeding Epic 5.1 directly.

**R-8 Payment transaction storage.** Epic 12 amended: every Stripe lifecycle event is normalized into a `payment_transaction` table and the raw webhook payload archived to S3 (Athena-queryable), giving reconciliation, auditing, and MRR/churn reporting without touching the production write path — §11.3.

**v2.4 — AI-generated search tags & prompt contract appendix.** (1) New **§6.10**: the existing `invoice.search_tags` column is upgraded from a manual/search affordance into AI-generated filtering metadata — the pipeline assigns up to 3 tags per invoice from a fixed, SSM-managed vocabulary, deterministic-first with an LLM piggyback path that adds zero extra model calls; tags are tenant-scoped (RLS), user-editable on the review screen, exposed as filter chips in both clients, and deliberately excluded from the Price Observation Store. (2) New **Appendix B**: the LLM prompt contracts that §0.2 Finding 6 promised are now written out verbatim — one contract per model operation (vision parse, merchant fallback, product expansion + tags, classification tiebreak, weekly advisor, embedder input format) with the model role, suggested initial model, token ceilings, temperature, and output schema for each, plus a model-assignment table. Prompts are versioned artifacts in the repo; `prompt_version` is added to `invoice_feedback.model_ids_snapshot`. (3) Minor touch-points: §8 schema annotation + GIN index on `search_tags`, Epic 6/15 amendments, §10 UI filter-chip and tag-edit notes.

---

## SECTION 1 — PRODUCT DEFINITION

### 1.1 Vision

Wobblio is a cloud-native personal fiscal management utility that converts photographed receipts, invoices, and restaurant bills into structured, classified, long-lived financial data using multimodal AI — with zero manual entry and no dependency on bank feeds. Because every parsed receipt contributes anonymized price points to a regional price database, Wobblio compounds into an independent, crowdsourced local market price index that no bank-feed competitor can replicate. That index powers the three differentiating capabilities: historical cross-vendor price comparison, automatic shopping-list splitting across stores for maximum savings, and proactive budget protection.

### 1.2 Core capabilities (sales pitch)

**Zero Manual Entry AI Capture.** Photograph any receipt worldwide; the vision pipeline extracts merchant, date, line items, quantities, unit sizes, taxes, and totals into structured data automatically, with a one-screen review step that doubles as the model's training signal.

**The Anti-Inflation Price Engine.** Wobblio tracks what *you and your region* actually paid, per product, per store, over time — real shelf prices from real receipts, not scraped web prices that ignore in-store promotions.

**Smart Route Shopping Lists.** When the historical price data shows that splitting a shopping list across two or three nearby stores saves more than a configurable threshold, Wobblio partitions the list into store-specific sub-lists and quantifies the saving.

**Proportional Bill Splitting.** Tag whole line items or fractional units to contacts; taxes, tips, and service fees scale proportionally to each person's subtotal; the result exports as a clean WhatsApp-ready summary.

**Cross-Border Currency Harmonization.** Foreign receipts normalize into the user's home currency using the exchange rate of the transaction date, preserving honest historical comparisons for travelers.

### 1.3 Form-factor allocation

**Mobile (Flutter, iOS + Android):** capture-first. Camera flow, push alerts, offline-cached shopping lists with on-device check-off, item split-tagging, lightweight dashboards. Payloads are slimmed for cellular transport.

**Web (Next.js + Tailwind):** the command center. Dense historical tables, multi-level drill-downs, household administration, the 3-product/6-month comparison charts, budget configuration, data export, and the admin console.

---

## SECTION 2 — BUSINESS MODEL & MONETIZATION

### 2.1 Model

Freemium B2C subscription. The free tier exists to (a) let users evaluate the capture quality, and (b) seed the price-observation store with data — free users are not dead weight; their receipts build the moat. The premium tier sells the *intelligence* on top of that data: households, budgets with alerts, bill splitting, comparison analytics, route optimization, and the weekly AI advisor.

### 2.2 Plans and pricing

**Standard (Free):** 3 invoice uploads/week, 3 active shopping lists, reporting limited to totals by top-level category for the current and previous month, single currency, no household, no alerts, no split-route optimizer, no bill splitting.

**Premium — €2.50/month or €25/year (promoted default, "2 months free"):** 10 uploads/week personal quota, 10 active lists, household creation (≤5 members, +20 uploads/week pooled household quota), budgets with 85%/100% alerts, matrix bill splitting, multi-currency harmonization, full reporting suite, split-route optimizer, weekly AI savings advisor.

Annual is promoted everywhere the upgrade is offered because the €0.25 fixed payment fee is incurred once per year instead of twelve times, lifting net margin per subscriber by roughly 9 percentage points, and because annual prepayment effectively eliminates month-2 churn.

**Sales channel rule (binding):** subscriptions are sold *only* via Stripe Checkout on the web app. Mobile apps never present an in-app purchase; they deep-link to the web upgrade flow where store rules allow, otherwise they show a neutral plan-management notice. This avoids the 15–30% app-store commission that would otherwise consume the entire margin at this price point.

### 2.3 Role hierarchy

Four database-level classifications, unchanged from v1:

1. `STANDARD` — free users, core caps apply.
2. `PREMIUM` — full feature suite, premium caps apply.
3. `TESTER` — created only via internal scripts; bypasses public caps; quotas read from an admin-configurable limits table.
4. `ADMIN` — created only via direct backend manipulation; RBAC clearance for the admin console; effectively uncapped for verification work.

Role escalation through any client-facing API is impossible by construction: the role column is never writable by any application-exposed mutation; it changes only via the Stripe webhook handler (`STANDARD` ↔ `PREMIUM`) or operator scripts (`TESTER`, `ADMIN`).

### 2.4 Unified quota matrix (resolves v1 inconsistencies)

| Quota | STANDARD | PREMIUM | TESTER | ADMIN |
|---|---|---|---|---|
| Personal uploads / week | 3 | 10 | per limits table | unlimited |
| Household membership | join only | create + join | per limits table | unlimited |
| Household pooled uploads / week | — | 20 per household (additive, drawn only by uploads into the household space) | per limits table | unlimited |
| Active shopping lists | 3 | 10 | per limits table | unlimited |
| Reporting depth | top-level categories, 2 months | full drill-down, full history | full | full |
| Products in comparison chart | — | 3 | per limits table | unlimited |
| Budget definitions | — | 10 | per limits table | unlimited |

Pooling rule, stated once and enforced in one domain service: an upload targeted at a household draws from the household pool of 20/week; an upload targeted at the personal space draws from the personal quota. Neither borrows from the other. A household of five premium members therefore has 5×10 personal + 20 pooled = 70 theoretical weekly uploads, which is intentional: heavy households are the best data contributors.

### 2.5 Waitlist guardrail

Unchanged mechanism, with the flow now fully specified end to end:

1. A Cognito pre-signup Lambda compares the live count of `STANDARD` users (maintained as a single atomically-incremented counter row, not a `COUNT(*)` scan, to avoid race conditions and table scans) against SSM `max_free_users_cap`.
2. Over cap → the account is still created in Cognito but flagged `STATUS_WAITLIST` in custom attributes and the profile row; all functional endpoints return `423 Locked` with a waitlist payload; the client renders the waitlist screen with position and a "skip the line — go Premium" CTA.
3. The CTA leads to Stripe Checkout. The `checkout.session.completed` webhook flips the user to `PREMIUM`, clears `STATUS_WAITLIST`, and unlocks the account in the same transaction. Payment is therefore the bypass, and it works because billing (Epic 12) exists.
4. When the admin raises the cap, a release job promotes waitlisted accounts in FIFO order and emails them via SES.

---

## SECTION 3 — PRO FORMA FINANCIAL MODEL (CORRECTED)

All scenarios: 10,000 registered users, 40% monthly activity rate, prices include 21% blended EU VAT, Stripe EEA card pricing approximated at 1.5% + €0.25 (the v1 model used the 2.9% non-EEA rate; the corrected model keeps a conservative blended 2.2% + €0.25), 70% of premium on annual billing (amortized monthly), 30% monthly billing.

| Line | Stretch: 20% premium (v1 case) | Optimistic: 10% | **Base: 4%** |
|---|---|---|---|
| Premium subscribers | 2,000 | 1,000 | 400 |
| Gross revenue / month | €5,000.00 | €2,500.00 | €1,000.00 |
| VAT (21% out of gross) | −€867.77 | −€433.88 | −€173.55 |
| Payment fees (blended, annual-weighted) | −€152.00 | −€76.00 | −€30.40 |
| AWS baseline (RDS €14 + compute/storage/traffic €55) | −€69.00 | −€69.00 | −€69.00 |
| GenAI inference (scales with *all* active users, not premium) | −€131.70 | −€131.70 | −€131.70 |
| **Net operating cash flow / month** | **≈ €3,779** | **≈ €1,789** | **≈ €595** |

Key structural observations the v1 model hid: AI and infrastructure costs scale with total active users (free users scan too — that is the point), while revenue scales only with premium count, so the conversion rate is the entire business. Break-even sits at roughly 130–150 premium subscribers (~1.4% conversion at 10k users). The €0.25 fixed fee on monthly billing consumes 10% of a €2.50 charge, which is why the annual plan is promoted; at 70% annual mix the blended fee burden drops from ~12.9% to ~3.0% of gross. Free-tier AI cost per free active user is ≈ €0.018/month (3 scans/week ceiling, Qwen-class vision pricing) — cheap enough that free users are profitable as data contributors, but it justifies keeping the cap and the waitlist guardrail.

Costs deliberately excluded and to be tracked as they materialize: Apple/Google developer accounts (€99/yr + $25 one-off), domain/email, Stripe billing portal (free tier sufficient), marketing (assumed organic at this stage), and the future RDS Proxy upgrade (~€11/month when triggered by Finding 8's concurrency threshold).

---

## SECTION 4 — REQUIREMENTS REVIEW: GAP & INCONSISTENCY REGISTER

A compact register of every gap or inconsistency found in v1, each with its disposition. Items marked ✦ are resolved in detail elsewhere in this document.

| # | Issue in v1 | Severity | Disposition |
|---|---|---|---|
| G-01 | No billing/subscription epic despite revenue model | Blocker | ✦ Epic 12 (Stripe Checkout + webhooks) |
| G-02 | In-app purchase commissions unmodeled | Blocker | Web-only checkout rule (§2.2) |
| G-03 | RLS isolation vs. cross-tenant price engine contradiction | Blocker | ✦ Price Observation Store (§6.5) |
| G-04 | No merchant canonicalization spec | Blocker | ✦ §6.2 |
| G-05 | No product normalization/categorization spec | Blocker | ✦ §6.3 |
| G-06 | No invoice classification spec | Major | ✦ §6.4 |
| G-07 | No duplicate detection (re-uploaded receipts corrupt budgets & price data) | Major | ✦ §6.6 |
| G-08 | No SQS idempotency (at-least-once redelivery double-processes) | Major | ✦ §6.6 / §7.4 |
| G-09 | No user-correction loop for OCR/parse errors | Major | ✦ §6.7 review screen + alias feedback |
| G-10 | Household pool (20/wk) vs. individual quotas incoherent | Major | Unified matrix + pooling rule (§2.4) |
| G-11 | Free reporting described inconsistently | Minor | Defined: top-level categories, 2 months (§2.4) |
| G-12 | Lambda ↔ t3.micro connection exhaustion; IAM-token latency | Major | ✦ §7.3 concurrency ceilings + pooling pattern |
| G-13 | No GDPR/data-lifecycle workstream despite sovereignty pitch | Major | ✦ Epic 13 |
| G-14 | No observability/cost-alarm workstream despite token-cost fears | Major | ✦ Epic 14 |
| G-15 | Budget-period attribution of backdated invoices undefined | Minor | Transaction-date attribution rule (§0.2 F-12) |
| G-16 | App-level encryption scope undefined (over-encrypting kills queryability) | Major | ✦ Narrowed field list (§7.5) |
| G-17 | Unit-price normalization absent (€/kg vs €/piece comparisons invalid) | Blocker for price engine | ✦ §6.3.4 |
| G-18 | Waitlist "paid bypass" flow had no payment mechanism | Major | §2.5 flow, depends on Epic 12 |
| G-19 | Race condition in pre-signup user counting | Minor | Atomic counter row (§2.5) |
| G-20 | DLQ existed but no replay/inspection tooling | Minor | Admin console DLQ panel (Epic 10 amendment) |
| G-21 | Model names (Claude 3.5, Qwen) will age | Minor | Already mitigated by SSM indirection; treat IDs as opaque config |
| G-22 | Per-country tax variance (e.g., NL 9%/21% BTW lines) unhandled in splitting | Minor | Splitter operates on receipt-printed tax totals, never recomputes rates (§5, Epic 9 amendment) |
| G-23 | No account deletion ↔ price-store interaction defined | Major | De-identification boundary (§6.5.4, Epic 13) |
| G-24 | Cold-start problem of crowdsourced price data unaddressed | Strategic | Mitigations in §6.5.5 |
| G-25 | Shared catalog & price store open to poisoning by malicious/low-quality uploads | Blocker for price engine | ✦ §6.8 quarantine + trust scoring |
| G-26 | No post-processing user feedback signal (quality KPI blind spot) | Major | ✦ §6.9 thumbs feedback |
| G-27 | GDPR export/deletion lacked an asynchronous, scalable workflow | Major | Epic 13 amendment (§9) |
| G-28 | Payment events not persisted for audit/reconciliation | Major | Epic 12 amendment + §11.3 |
| G-29 | No business-KPI collection or analytics layer | Major | ✦ §11.2 |
| G-30 | Capacity limits never tied to the actual db.t3.micro instance | Major | ✦ §7.3.1 capacity envelope |

---

## SECTION 5 — FEATURE SET (CONSOLIDATED, WITH AMENDMENTS)

The v1 feature inventory is preserved; this section lists only the deltas so the v1 epic content remains usable.

**New features added:** subscription billing & customer portal (Epic 12); GDPR data lifecycle (Epic 13); observability & cost governance (Epic 14); data-intelligence pipelines as first-class backend features (Epic 15, detailed in §6); parse-review/correction screen in both clients (amends Epic 6); DLQ inspection and replay panel plus alias-curation queue in the admin console (amends Epic 10); AI-generated search tags for invoice filtering (§6.10, amends Epics 6 and 15).

**Amended behaviors:** bill splitting uses tax/fee totals as printed on the receipt and allocates them proportionally to subtotal shares — it never re-derives tax rates, which keeps it correct across jurisdictions with mixed-rate line items (G-22). Budget accumulators attribute spend by transaction date with upload-date fallback (G-15). The comparison chart and route optimizer read exclusively from the Price Observation Store, never from other tenants' invoices (G-03).

**Explicitly deferred (out of scope for v2 build):** bank-feed import, barcode scanning as a capture mode (kept in mind for product matching — see §6.3.6), browser extension, B2B/accounting exports, and any social/leaderboard mechanics.


---

## SECTION 6 — THE DATA-INTELLIGENCE LAYER (NEW — CORE OF THIS REVISION)

This section is the heart of the revision. Everything Wobblio promises beyond bookkeeping depends on turning messy thermal-printer strings like `AH BIO HALFV MELK 1L 1,39 B` into the statement "Albert Heijn, Eindhoven region, sold 1L of organic semi-skimmed milk for €1.39/L on 2026-06-08." Five pipelines achieve this; they run in sequence inside the SQS ingestion worker after the vision model produces raw JSON.

```
 Receipt image (S3)
        │
        ▼
 ┌─────────────────────┐
 │ 1. VISION PARSE      │  Qwen-class multimodal model → raw structured JSON
 │    (raw extraction)  │  merchant block, date, currency, line items, taxes, total
 └─────────┬───────────┘
           ▼
 ┌─────────────────────┐
 │ 2. DEDUPLICATION     │  image hash + invoice fingerprint  → reject / flag
 └─────────┬───────────┘
           ▼
 ┌─────────────────────┐
 │ 3. MERCHANT          │  alias table → trigram fuzzy → LLM fallback
 │    CANONICALIZATION  │  → canonical merchant_id + region
 └─────────┬───────────┘
           ▼
 ┌─────────────────────┐
 │ 4. PRODUCT           │  per line item: expansion (LLM) → embedding match
 │    NORMALIZATION &   │  → canonical product_id, category, normalized
 │    CATEGORIZATION    │    unit price (€/kg, €/L, €/piece)
 └─────────┬───────────┘
           ▼
 ┌─────────────────────┐
 │ 5. INVOICE           │  merchant-prior + line-item vote + LLM tiebreak
 │    CLASSIFICATION    │  → invoice macro-category
 └─────────┬───────────┘
           ├──────────────► tenant tables (RLS-protected): invoice, line items
           └──────────────► PRICE OBSERVATION STORE (anonymized, no RLS)
```

The user-facing contract: parsing is asynchronous; the dashboard card shows `PROCESSING → NEEDS_REVIEW | PARSED | FAILED_PROCESSING`. `NEEDS_REVIEW` fires when any pipeline stage falls below its confidence threshold (§6.7). After stage 5, a zero-cost enrichment step assigns up to 3 search tags to the invoice (§6.10); the LLM prompt contracts for every model call in this pipeline are written out in Appendix B.

### 6.1 Vision parse contract

The vision model receives the (client-compressed) image plus a strict instruction to emit only JSON conforming to this schema; the worker validates with a JSON-schema validator and retries once with the validation errors echoed back before routing to the DLQ.

```json
{
  "merchant_block": { "raw_name": "string", "raw_address": "string|null",
                      "vat_or_registration_id": "string|null", "phone": "string|null" },
  "transaction":    { "date": "YYYY-MM-DD|null", "time": "HH:MM|null",
                      "currency": "ISO-4217|null", "total": "decimal",
                      "taxes": [ { "rate_label": "string", "amount": "decimal" } ],
                      "service_fee": "decimal|null", "tip": "decimal|null" },
  "line_items": [   { "raw_text": "string", "quantity": "decimal|null",
                      "unit_size_raw": "string|null", "unit_price": "decimal|null",
                      "line_total": "decimal", "discount_flag": "boolean" } ],
  "document_kind_hint": "RECEIPT|INVOICE|RESTAURANT_BILL|OTHER",
  "parse_confidence": "0.0-1.0"
}
```

Arithmetic sanity check after parse: Σ(line_total) − discounts must reconcile with `total` within €0.05 or 1%; failure lowers confidence and triggers `NEEDS_REVIEW` rather than rejection (receipts legitimately contain deposit refunds, rounding lines, and loyalty discounts).

### 6.2 Merchant canonicalization (seller normalization)

**Problem.** The same seller appears as `AH 1325 EINDHOVEN`, `ALBERT HEIJN 1325`, `Albert Heijn B.V.`, or `AH to go CS`. Price comparison, merchant drill-downs, and classification priors all require a single canonical identity, ideally at two levels: the **brand** (Albert Heijn) and the **branch** (store #1325, Eindhoven) — prices are compared at brand level within a region, while route optimization cares about branches.

**Data model.**

```sql
merchant            (id, brand_name, country_code, default_category_id,
                     website, created_via ENUM('SEED','AUTO','ADMIN'), status)
merchant_branch     (id, merchant_id, branch_label, address, city, postal_code,
                     geo_point NULL, external_store_number NULL)
merchant_alias      (id, merchant_id, branch_id NULL, alias_normalized TEXT,
                     vat_id NULL, match_count INT, last_seen_at,
                     source ENUM('SEED','AUTO_FUZZY','AUTO_LLM','USER_CONFIRMED','ADMIN'))
-- unique index on (alias_normalized, country_code); pg_trgm GIN index on alias_normalized
```

**Resolution algorithm (per receipt):**

1. **Normalize the raw string:** uppercase, Unicode-fold, strip legal suffixes (`B.V.`, `GMBH`, `S.A.`, `LTD`), collapse whitespace, strip trailing store numbers and city names into separate captured fields (`AH 1325 EINDHOVEN` → alias key `AH`, store_number `1325`, city `EINDHOVEN`).
2. **Hard identifier match:** if the receipt printed a VAT/registration ID (very common on EU receipts), look it up directly in `merchant_alias.vat_id` — this is authoritative and short-circuits everything.
3. **Exact alias hit** on `(alias_normalized, country_code)` → done. This will serve >95% of traffic at steady state because aliases accumulate.
4. **Fuzzy match:** `pg_trgm` similarity against existing aliases within the user's country, accept at similarity ≥ 0.65 **and** a ≥0.15 margin over the runner-up; record the matched variant as a new `AUTO_FUZZY` alias so step 3 catches it next time.
5. **LLM fallback (auxiliary model, Haiku-class):** prompt contains the raw merchant block plus the top-10 fuzzy candidates and the country's seed brand list; the model must answer with either a candidate ID or `NEW_MERCHANT` plus a cleaned brand name. `NEW_MERCHANT` creates a `status='PROVISIONAL'` merchant row.
6. **Curation:** provisional merchants and low-margin matches enter the admin alias-curation queue (Epic 10 amendment). Users can also correct the merchant on the review screen; a user correction writes a `USER_CONFIRMED` alias, which outranks automatic sources on future conflicts.

**Seeding.** Before launch, load the top grocery/drugstore/fuel chains per launch country (for NL: Albert Heijn, Jumbo, Lidl, Aldi, Plus, Dirk, Kruidvat, Etos, Trekpleister, HEMA, Action, …) with their common receipt abbreviations as `SEED` aliases. A half-day of manual work per country that removes the cold-start error rate where it matters most.

**Branch resolution** is best-effort: store number and/or postal code from the receipt map to `merchant_branch`; unmatched branches are created provisionally. Branch-level data only feeds route optimization; nothing else depends on it, so its accuracy can mature gradually.

### 6.3 Product normalization & categorization

**Problem.** Receipt line items are truncated, abbreviated, brand-prefixed, multi-language strings: `AH BIO HALFV MELK 1L`, `JUMB ROOMBOTER ONGEZ 250G`, `COCA COLA ZERO 6X33CL`. To compare prices, two different strings for the same underlying product must converge on one `product_id`, and quantities must normalize to a comparable unit price.

**Two-level identity model.** A **canonical product** is brand + product + variant + pack size (`Albert Heijn Biologisch Halfvolle Melk 1L`). A **product concept** sits above it (`semi-skimmed milk, organic`) and groups competing brands; price comparison across *stores* works at product level (exact repurchase), while "cheapest place to buy milk" suggestions work at concept level. Concepts are optional metadata at launch; products are mandatory.

**Data model.**

```sql
product_category   (id, parent_id NULL, name, level SMALLINT)        -- 2-level taxonomy
product_concept    (id, name, category_id)                            -- optional, phase 2
product            (id, concept_id NULL, category_id, brand TEXT NULL,
                    display_name, base_unit ENUM('KG','L','PIECE'),
                    pack_size_base_units NUMERIC NULL,                -- e.g. 0.25 for 250g
                    embedding vector(1024),                           -- pgvector
                    created_via, status)
product_alias      (id, product_id, alias_normalized, merchant_id NULL,  -- aliases are often
                    match_count, source, last_seen_at)                   -- merchant-specific
-- pgvector HNSW index on product.embedding; trgm index on product_alias.alias_normalized
```

**Taxonomy.** A fixed, two-level, Wobblio-owned taxonomy (~14 top-level × ~6–10 sub each): Groceries→(Dairy & Eggs, Produce, Meat & Fish, Bakery, Pantry, Frozen, Beverages, Alcohol, Snacks & Sweets), Household, Personal Care & Pharmacy, Baby & Kids, Pet, Dining Out, Transport & Fuel, Clothing, Electronics, Health, Home & Garden, Entertainment, Services, Other. Fixed taxonomies keep LLM classification constrained (the model selects from an enum, never invents labels), keep reports stable over time, and map cleanly to budget categories. GS1 GPC was considered and rejected for launch: too deep, licensing friction, poor fit for restaurant lines.

**Resolution algorithm (per line item):**

1. **Merchant-scoped exact alias hit** on the normalized raw string (most receipt strings are stable per chain — `AH BIO HALFV MELK 1L` is printed identically every time) → done. Steady-state hit rate will dominate.
2. **Batch LLM expansion** (auxiliary model, one call per receipt, all unresolved lines together): expand abbreviations and emit structured fields per line — `{brand, product_name, variant, pack_quantity, pack_unit, category_id from enum, is_deposit_or_fee}`. The prompt includes the resolved merchant brand (which disambiguates house brands: `AH` prefix at Albert Heijn means the house brand) and the country language hint. Deposit lines (`STATIEGELD`), bag fees, and discount lines are flagged and excluded from product matching but kept on the invoice.
3. **Embedding match:** embed `brand + product_name + variant + pack` (Bedrock Titan/Cohere-class embedding model, also SSM-configured as `/wobblio/config/models/embedder`) and run pgvector cosine search filtered to the same category. Accept at similarity ≥ 0.92; create a new `PROVISIONAL` product below 0.85; the 0.85–0.92 band attaches the *best* candidate but flags the line `LOW_CONFIDENCE` for the review screen.
4. **Alias write-back:** every resolution writes/updates a merchant-scoped `product_alias`, so step 1 absorbs the traffic and LLM cost decays over time. This is the central cost-control property of the whole design: per-line LLM spend trends toward zero on repeat purchases, which is exactly the purchase pattern of groceries.
5. **User corrections** on the review screen (reassign product, fix size, fix category) write `USER_CONFIRMED` aliases and immediately repair the derived price observation.

**6.3.4 Unit-price normalization (G-17 — mandatory for any comparison).** Parse `unit_size_raw` (`1L`, `6X33CL`, `250G`, `PER KG 0.482 KG`) into `(pack_quantity, base_unit)`: multipack multiplication (6×33cl = 1.98 L), weight-priced items use the printed weight, piece goods fall back to `PIECE`. Normalized unit price = line_total ÷ quantity ÷ pack_size_base_units. Every price observation stores both the paid pack price and the normalized €/kg | €/L | €/piece figure; comparisons always use the normalized figure and never compare across different base units. Lines where size cannot be parsed produce **no** price observation (they still appear on the user's invoice) — a smaller, clean price dataset beats a larger, polluted one.

**6.3.6 Future accelerant:** when a receipt prints EAN/GTIN codes (some chains do), capture them into `product.gtin` — they are globally unique and make matching trivial. Also the hook for a later barcode-scan capture mode.

### 6.4 Invoice classification

Each invoice gets one macro category for free-tier reporting and budget mapping. Three signals, cheapest first: (1) **merchant prior** — `merchant.default_category_id` (a Kruidvat receipt is Personal Care & Pharmacy unless evidence says otherwise); (2) **line-item vote** — the category carrying the largest share of spend on the invoice; (3) **LLM tiebreak** (auxiliary model) only when (1) and (2) disagree *and* no single category exceeds 50% of spend. `document_kind_hint=RESTAURANT_BILL` forces Dining Out. The user can override on the review screen; overrides update nothing global (a personal reclassification is not evidence about the merchant) but are remembered as a per-tenant merchant→category preference.

### 6.5 The Price Observation Store & cross-store comparison engine (G-03)

**The architectural resolution.** Tenant data stays under RLS, untouched. At the end of successful ingestion, the worker emits *de-identified* price points into a separate table that carries **no tenant, user, household, or invoice reference** and is exempt from RLS:

```sql
price_observation  (id, product_id, merchant_id, country_code,
                    region_code,             -- coarse: first 2 digits of postal code
                    observed_on DATE,        -- transaction date, day precision only
                    pack_price NUMERIC, normalized_unit_price NUMERIC,
                    base_unit, currency, was_discounted BOOLEAN,
                    quality ENUM('AUTO','USER_CONFIRMED'))
-- index (product_id, merchant_id, region_code, observed_on)
-- NO foreign key to invoice or tenant — deliberate
```

De-identification rules: region is coarsened to a ~city-sized postal prefix; time is day-granular; there is deliberately no key path back to the contributing user, which is also what makes account erasure clean (§6.5.4). Aggregation queries additionally apply a k-threshold at read time (suppress a merchant/product/region cell unless ≥3 distinct observations exist in the window) so a lone shopper in a small region cannot be re-identified through the comparison UI.

**6.5.1 Comparison query (Premium reporting, the 3-product/6-month chart).** For each selected product: weekly median `normalized_unit_price` per merchant per region over the trailing 26 weeks, current-merchant line emphasized, discounted observations rendered as distinct markers rather than blended into the median (promo prices are signal, but a different signal).

**6.5.2 "Cheapest store" resolution for a product:** latest 28-day median per merchant within the user's region; require ≥3 observations per merchant cell; stale cells (no observation in 60 days) are shown greyed with their age. Honesty about data freshness is a feature: crowdsourced data is sparse at the edges and the UI must never pretend otherwise.

**6.5.3 Split-route optimizer (Epic 8.4, now buildable).** Input: a shopping list resolved to product_ids (list items autocomplete against the product table; free-text items that match nothing are simply excluded from optimization and assigned to the primary store). Algorithm: (1) build the price matrix product × candidate merchants (merchants with sufficient regional data); (2) compute the single-best-store baseline = min over merchants of Σ best-known prices with missing cells filled by the user's historical average for that product; (3) compute the unconstrained minimum = Σ per-product minima; (4) if unconstrained_min saves more than the SSM threshold (`/wobblio/config/routing/min_split_saving`, default €5.00) versus baseline, partition greedily into at most `max_stores` (default 3) sub-lists, merging any sub-list whose marginal saving is below €1.50 into the main store. Output: per-store sub-lists with line-level expected prices, total expected saving, and per-line confidence (observation count + age). This is deliberately a heuristic, not an optimization-perfect solver — with ≤3 stores and honest confidence labeling, greedy is indistinguishable from optimal for the user and trivially debuggable for you.

**6.5.4 Erasure boundary (G-23, feeds Epic 13).** Account deletion removes all tenant rows (invoices, items, lists, budgets, households where owner, Cognito identity). Price observations persist because they were never personal data after de-identification — this is documented in the privacy policy in exactly those terms. A user-facing toggle "don't contribute my prices to the anonymous price index" (default on, off switchable) suppresses emission for that tenant going forward; this preserves trust without offering retroactive deletion of unattributable rows, which would be technically meaningless anyway.

**6.5.5 Cold-start mitigations (G-24).** The comparison features degrade gracefully rather than block: (a) the user's *own* price history per product is always available from day 1 and is independently valuable ("you paid 12% more for this than last month"); (b) regional comparison unlocks visually as density grows, with the UI stating "2 stores tracked in your area — scan more receipts to unlock comparisons" — turning the gap into a contribution motivator; (c) launch marketing concentrates on one metro area to reach density quickly rather than spreading thin; (d) seed the store with a few weeks of founder/tester scanning across the launch city's main chains.

### 6.6 Deduplication & idempotency (G-07, G-08)

**Layer 1 — transport idempotency:** the SQS consumer's first action is `INSERT ... ON CONFLICT DO NOTHING` of the S3 object key into `ingestion_ledger(s3_key, status, attempt_count)`; a duplicate delivery short-circuits. All downstream writes for one ingestion run inside one transaction keyed to that ledger row, so redelivery after a mid-run crash resumes cleanly rather than double-writing.

**Layer 2 — content duplicates:** (a) exact: SHA-256 of the uploaded bytes, unique per tenant — the same photo uploaded twice is rejected at presign-confirmation time with a friendly "already scanned" response, costing zero AI tokens; the same hash is *also* checked cross-tenant (hash-only, no content crosses the tenant boundary): a collision across unrelated accounts is not rejected (printed duplicates can legitimately exist) but voids catalog corroboration and flags the cluster per §6.8 Layer 1a; (b) fuzzy: after parsing, the fingerprint `(merchant_id, transaction_date, total, line_count)` is checked per tenant scope; a hit marks the new invoice `SUSPECTED_DUPLICATE` and the review screen asks the user to confirm or discard — re-photographing yesterday's receipt from a different angle defeats the hash but not the fingerprint. Confirmed duplicates emit no price observations and do not consume quota.

### 6.7 The review screen & human-in-the-loop quality flywheel (G-09)

After parsing, invoices with any low-confidence stage (or fuzzy-duplicate suspicion) land in `NEEDS_REVIEW`; all others go straight to `PARSED` with an unobtrusive "check & correct" affordance. The mobile review screen shows the receipt photo and parsed fields side-by-side; tap-to-fix on merchant, date, total, any line's product/size/price; one confirm button. Every correction feeds the alias tables (§6.2 step 6, §6.3 step 5), repairs derived price observations, and upgrades them to `quality='USER_CONFIRMED'`. This loop is what turns parsing from a static cost into a system that gets cheaper and more accurate with every active user — treat the review UX with the same seriousness as the capture UX.


---

### 6.8 Catalog integrity & anti-poisoning (R-1, G-25)

The global merchant/product catalog and the price observation store are shared assets; a single malicious or careless tenant must not be able to pollute them. Four layers, cheapest first, all enforceable inside the existing ingestion worker and existing tables (no new infrastructure):

**Layer 1 — Provisional visibility (quarantine by default).** Every merchant or product created automatically (`created_via='AUTO'`, `status='PROVISIONAL'`) is globally hidden but **fully functional for its creator**. This boundary must be understood precisely, because it determines the user experience for the entire long tail of rare products:

*What the contributing user experiences — nothing is held.* The invoice completes normally (`PARSED`, never a quarantine-related pending state); every line item is visible immediately; totals flow into budgets and reports in the same ingestion transaction; the provisional product appears in the user's own autocomplete and can be added to their shopping lists; and their **personal price trend for that product works from the very first observation** ("you paid €1.39 — 8% more than last month"). Quarantine is a property of the *global* layer, never of the user's own data. Concretely: shopping-list autocomplete searches `ACTIVE` global products **∪ the tenant's own provisional products**; personal trend charts read the tenant's own invoice lines, which RLS already scopes correctly.

*What other users experience.* The entity is absent from their autocomplete, comparison charts, and the route optimizer, and its price observations carry `quarantined=true`, excluded from aggregate reads. For a product seen on exactly one invoice this withholds almost nothing real: a single observation could never satisfy the k≥3 read threshold (§6.5) anyway, so no cross-store comparison or regional trend was possible regardless of moderation. For rare products, **data density — not quarantine — is and always was the binding constraint**; quarantine adds no practical delay to the features users can perceive.

**Promotion to `ACTIVE`** happens when any of: the entity has been independently resolved from receipts of ≥3 distinct *eligible* tenants (eligibility defined in Layer 1a); ≥2 distinct eligible tenants have user-confirmed it on the review screen; or an admin approves it in the curation queue (the queue sorts provisional entities by how many tenants are waiting on them, so genuinely popular new products surface first). Independent corroboration is the cheapest possible moderation workforce — real products get scanned by many unrelated people, fake ones don't.

**Layer 1a — Sybil resistance of the promotion quorum.** "Three distinct tenants" is trivially defeated by three fake accounts, so corroboration is gated, not merely counted. A tenant is an **eligible corroborator** only if: account age ≥ 7 days; ≥ 5 successfully parsed receipts; trust score not below the default; and a device/network signature (salted hash of device identifier + IP prefix captured at upload) distinct from every other corroborator of the same entity — three accounts on one phone count as one. Additionally, two collusion detectors void corroboration outright and flag the account cluster for admin review: (a) **cross-tenant image-hash collision** — the same SHA-256 arriving from multiple accounts means one photo recycled across accounts, which honest users essentially never produce; (b) **cross-tenant fingerprint collision** — the same (merchant, transaction date, total) from multiple *new* accounts within a short window, the signature of one fabricated receipt re-photographed. Household members legitimately share receipts, so household co-membership exempts detector (b). Eligibility raises the attack cost from "three signups" to "weeks of maintaining genuinely active accounts across distinct devices and networks with distinct fabricated photos."

*Bounded blast radius even if all of that is paid for:* the attacker's prize is one fake product in autocomplete whose observations still pass the plausibility bands (Layer 2), still need k≥3 to render anywhere, are still trust-weighted (Layer 3) — and a single admin action in the curation queue purges the entity with a cascade delete of its observations. The defense target is making the attack cost exceed any conceivable payoff, which for a consumer receipt app is the correct bar; cryptographic impossibility is not. The complete decision model — state machine, decision table, and worked scenarios — is documented in **Appendix A** and is the canonical reference for this subsystem.

**Layer 2 — Statistical price plausibility.** Before a price observation is written, its normalized unit price is tested against the trailing 90-day median for (product, region): values outside [median ÷ 4, median × 4] are quarantined, not rejected (legitimate extremes exist; quarantine preserves them for review). When no product history exists, category-level bounds apply (maintained as a small static table, e.g. Dairy 0.20–25 €/L). Quantity sanity caps (line quantity ≤ 200, line total ≤ €10,000 for grocery-class categories) catch OCR misreads and deliberate manipulation alike — misreads being by far the more common case, which is why this filter pays for itself in data quality even with zero attackers.

**Layer 3 — Tenant trust scoring.** A `trust_score` (0–100, default 20) per tenant, recomputed nightly: points added for account age, confirmed reviews, thumbs-up feedback (§6.9), premium status, and entities the tenant created that were later corroborated by others; points removed for quarantine hits, confirmed duplicates, and entities rejected in curation. Observations are weighted by contributor trust in aggregate queries; tenants below 10 contribute quarantined-only; tenants above 60 get a relaxed plausibility band. The score is internal — never displayed — to avoid gamification.

**Layer 4 — Velocity limits.** New-entity creation is capped per tenant per day (default 10 new provisional merchants, 60 new provisional products, SSM-tunable); breaching the cap doesn't block the user's invoice (lines simply stay unmatched, `product_id NULL`) but flags the tenant in the admin console. Combined with the existing upload quotas, this bounds the worst-case poisoning blast radius of any single account to a handful of quarantined, never-served rows.

The k-threshold at read time (§6.5, ≥3 distinct observations per served cell) remains the final backstop: even a promoted entity needs corroborated price data before any other user ever sees a number derived from it.

### 6.9 User feedback loop (R-3, G-26)

After an invoice reaches `PARSED` (or the user completes a review), both clients show an unobtrusive thumbs-up / thumbs-down affordance on the invoice card. One tap, optional follow-up: a thumbs-down opens a three-chip reason picker (`Wrong items`, `Wrong merchant/total`, `Other`) plus an optional free-text note, and offers a shortcut into the correction screen.

```sql
invoice_feedback (id, invoice_id, tenant_id, verdict ENUM('UP','DOWN'),
                  reason ENUM('ITEMS','MERCHANT_TOTAL','OTHER') NULL,
                  comment_enc TEXT NULL, model_ids_snapshot JSONB, created_at)
```

`model_ids_snapshot` records which vision/auxiliary/embedder models — and, as of v2.4, which prompt versions (Appendix B.0) — produced the parse, so quality can be compared across model swaps — this is what makes the admin console's live model-swap matrix *measurable* rather than vibes-based. Feedback feeds four consumers: the daily KPI aggregation (§11.2: feedback ratio as the OCR-quality proxy); trust scoring (§6.8, Layer 3); an alarm (§11.1) when the daily DOWN-ratio breaches threshold — the earliest detector of a bad model swap or an upstream model regression; and a de-identified evaluation set, where DOWN-rated invoices (image + parsed JSON, tenant reference stripped, free-text comments excluded) enter the curation queue to become regression test cases for prompt and model changes.

### 6.10 AI-generated search tags (v2.4 — invoice filtering metadata)

**Purpose.** Each invoice receives **up to 3 tags** — short, human-readable labels like `weekly-groceries`, `bbq`, `back-to-school`, `road-trip`, `household-supplies` — that customers use to filter and search their invoice history. Tags answer a different question than the category taxonomy: the category says *what kind of spend this is* (Groceries → Dairy), the tag says *what this purchase was for*. The `invoice.search_tags TEXT[]` column and the top-bar "search by tag" affordance already exist in the v2.3 schema and web layout; this section specifies how the pipeline populates them.

**6.10.1 Fixed vocabulary, not free text.** Tags are selected from a curated, fixed vocabulary (~60–80 tags at launch, per launch country, stored as an SSM parameter `/wobblio/config/tags/vocabulary` so it is admin-editable live, like every other tunable). This mirrors the taxonomy design rule in §6.3: a constrained vocabulary means the model selects from an enum and never invents labels, filtering converges (`bbq` and `barbecue` can never coexist as distinct tags), the UI can render a stable chip set, and there is zero moderation surface for model-invented strings. Each vocabulary entry carries: `tag_key` (stable, lowercase-kebab), localized display names, and a **deterministic trigger map** — a list of `(category_id, min_spend_share)` pairs and/or merchant brands that imply the tag.

**6.10.2 Generation: deterministic first, LLM as a free rider.** Consistent with the cost philosophy of §6.3 (per-line LLM spend trends toward zero on repeat purchases), tag generation must not introduce a model call on the steady-state path, where a fully alias-resolved receipt is processed with **no** LLM invocation at all. Two paths, merged:

1. **Deterministic prior (always runs, zero cost).** After classification (stage 5), evaluate the vocabulary's trigger maps against the resolved invoice: category spend shares and the canonical merchant. Example rules: ≥60% spend in Groceries sub-categories → `weekly-groceries`; merchant brand is a fuel chain → `fuel`; `document_kind_hint=RESTAURANT_BILL` → `dining-out`. Matching tags are ranked by spend share; the top 3 are assigned.
2. **LLM piggyback (only when a model call happens anyway).** Whenever the batch expansion call of §6.3 step 2 runs (i.e., the receipt contained unresolved lines), its output contract is extended with one invoice-level field, `suggested_tags` (Appendix B.3) — the model picks 0–3 tags from the vocabulary, which is embedded in the prompt as an enum. Suggested tags are validated against the vocabulary (out-of-vocabulary strings are silently dropped — never stored, never surfaced), merged with the deterministic set, deduplicated, and capped at 3 with deterministic tags winning ties. Marginal cost: a few dozen output tokens on a call that was being paid for regardless.

An SSM flag (`/wobblio/config/tags/dedicated_call_enabled`, default **false**) can enable a dedicated auxiliary-model tag call for fully-aliased receipts if product experience later shows deterministic-only tags are too thin; it is off at launch because it would be the only per-invoice LLM cost that never decays.

**6.10.3 Storage, tenancy, and the privacy boundary.** Tags are written to `invoice.search_tags` inside the same ingestion transaction as everything else — a **tenant table under RLS**. Tags must **never** be emitted to the Price Observation Store: the store is deliberately keyed only by canonical product, merchant, region, and date (§6.5), and attaching behavioral labels like `road-trip` or `baby` to observations would re-open exactly the re-identification surface the de-identification rules closed. This is a hard rule, enforced by the emission code path simply having no tag parameter, and is restated in the Epic 13 privacy-policy text.

**6.10.4 User editing and the quality loop.** The review screen (§6.7) gains a tag row: current tags as removable chips plus an "add tag" picker over the vocabulary (search-as-you-type, same pattern as the product picker). User edits are authoritative and, like the category overrides of §6.4, update **nothing global** — a personal tag is not evidence about the merchant or product. Edits are however counted in `kpi_daily` (tag-edit rate, the quality proxy for this feature; a high edit rate on a specific tag is the signal to tune its trigger map).

**6.10.5 Confidence behavior.** Tags are decorative metadata, not financial data: uncertain tags are simply **omitted** — a tag never triggers `NEEDS_REVIEW`, never blocks `PARSED`, and an invoice with zero tags is a perfectly valid outcome. A wrong total matters; a missing tag does not.

**6.10.6 Filtering UX and indexing.** Both clients expose tags as filter chips: web on the Invoices table (alongside saved filters) and in the top-bar global search; mobile as a horizontally scrolling chip row above the recent-invoices list. Queries use PostgreSQL array operators (`search_tags && ARRAY[...]` for any-of, `@>` for all-of) backed by a **GIN index** on `invoice.search_tags` — cheap, standard, and already supported by the installed extensions (no new infrastructure, consistent with §6.8's constraint). Free-tier users get tag filtering within their 2-month reporting window; premium gets it across full history — the tag feature itself is not premium-gated, because tags on free-tier invoices increase perceived capture quality, which is what the free tier exists to demonstrate (§2.1).

**Decision recorded — invoice-level, not product-level, at launch.** Tags could alternatively live on the canonical `product` row ("everything organic"), but that would make them shared catalog data subject to Appendix A's provisional/quarantine machinery and a poisoning surface per §6.8. Invoice-level tags are private, cheap, and ship with the current schema unchanged. Product-level tags are explicitly deferred and, if ever built, must route through the same promotion gates as any other shared catalog attribute.

---

## SECTION 7 — ARCHITECTURE (REVIEWED & REVISED)

### 7.1 High-level system design

```
                         ┌───────────────────────── CLIENTS ─────────────────────────┐
                         │  Flutter (iOS/Android)            Next.js Web + Admin     │
                         └───────┬───────────────────────────────────┬───────────────┘
                                 │ JWT (Cognito)                     │
                                 ▼                                   ▼
        ┌─────────────┐   ┌──────────────────────────────────────────────────┐   ┌─────────────┐
        │ AWS Cognito  │◄──┤        Amazon API Gateway (REST, single API)     ├──►│ Stripe       │
        │ +Google/Meta │   │        JWT authorizer · throttling · WAF-lite    │   │ Checkout +   │
        │ pre-signup λ │   └───────────────┬──────────────────────────────────┘   │ webhooks ────┼──► billing λ
        └─────────────┘                    ▼                                       └─────────────┘
                              ┌──────────────────────────┐
                              │  Lambda fleet (AWS SDK v3)│  hexagonal core: domain + ports
                              │  api-* handlers           │  reserved-concurrency capped
                              └───────┬─────────┬────────┘
              presigned PUT           │         │ SET LOCAL app.current_tenant_id
   Client ───────────────► S3 ◄───────┘         ▼
   (compressed image)      │            ┌──────────────────┐         ┌──────────────────────┐
                           │ S3 event   │ RDS PostgreSQL    │         │ SSM Parameter Store   │
                           ▼            │ db.t3.micro       │         │ model ids · caps ·    │
                      ┌─────────┐       │ RLS tenant tables │◄────────│ thresholds (admin-    │
                      │   SQS    │       │ + price_observat. │  reads  │ editable, live)       │
                      │ ingest  ─┼─DLQ   │ + pgvector,pg_trgm│         └──────────────────────┘
                      └────┬────┘       └──────────────────┘
                           ▼                     ▲
                  ┌──────────────────┐           │ writes (tenant + price store)
                  │ ingestion worker │───────────┘
                  │ λ: parse→dedupe→ │──────► AWS Bedrock Converse API
                  │ merchant→product │        vision_parser / auxiliary / embedder / insight
                  │ →classify→emit   │
                  └──────────────────┘
   EventBridge crons: budget-recycler · fx-rates-daily · weekly-advisor · waitlist-release
   Notifications: SNS (push) · SES (email)        Observability: CloudWatch + AWS Budgets alarms
```

### 7.2 What the review confirmed

The hexagonal layering, CDK stack separation (independent stateful DB stack vs. fast-moving app stacks), LocalStack-based local sandbox, presigned-URL upload path, SQS decoupling with DLQ, RLS-with-`SET LOCAL` tenancy, cdk-nag gating, and Day-0 public-subnet guardrails (security-group whittling to the Lambda SG only, IAM token auth, KMS field encryption) are all retained as specified in v1. Two PostgreSQL extensions are added to the database stack: `pg_trgm` (merchant/product fuzzy matching) and `pgvector` (product embeddings) — both supported on RDS PostgreSQL and free, replacing what would otherwise be a dedicated vector database line item.

### 7.3 Connection management (G-12 fix)

Reserved concurrency caps per function group: api-handlers pool ≤ 25 concurrent, ingestion worker ≤ 5 (SQS `maxConcurrency`), crons ≤ 2 — keeping worst-case connections ≈ 32, safely under t3.micro's ~85 ceiling with headroom for migrations and admin sessions. One connection per warm Lambda container, created lazily, with IAM auth tokens regenerated when older than 10 minutes (tokens live 15). Statement timeout 5s on api paths, 30s on workers. The named scale-up trigger: when p95 API concurrency exceeds 20 for a sustained week, add RDS Proxy (~€11/month) before raising any concurrency cap — the decision is pre-made so future-you doesn't improvise under load.

### 7.3.1 Explicit capacity envelope on db.t3.micro (R-2, G-30)

The current instance (db.t3.micro: 2 burstable vCPU, 1 GiB RAM, ~85 usable connections, 20 GiB gp3) is the binding constraint, and the system is explicitly sized to it rather than to aspiration. **Designed envelope:** 10,000 registered users, ~4,000 MAU, ~3,000 invoice ingestions/day sustained (≈2 effective ingestion-worker concurrency at ~5 s of DB work per receipt — well inside the §7.3 cap of 5), API p95 under 300 ms at ≤25 concurrent handlers. The envelope is *enforced*, not hoped for: `max_free_users_cap` defaults to 5,000 and the waitlist guardrail (§2.5) is precisely the mechanism that keeps load inside the envelope — capacity management and growth control are the same feature. CPU-credit exhaustion is the t3-specific failure mode, so the credit-balance alarm (§11.1) is mandatory and Unlimited mode stays **off**: a runaway query should alarm, not silently bill.

**Scaling ladder (each step is configuration, not architecture):** Step 1, at sustained API concurrency >20 — add RDS Proxy (~€11/mo). Step 2, at sustained CPU >60% or chronic credit pressure — modify the instance to db.t4g.small (~€26/mo; Graviton is also ~10% cheaper per unit, a minutes-of-downtime change made safe by the DB living in its own CDK stack). Step 3, at read-heavy reporting load — add one read replica and point the reporting adapter's read port at it (the hexagonal port split makes this a driven-adapter config change). Nothing in the schema, the workers, or the clients changes at any step — that is the payoff of the decoupled DB stack and the ports-and-adapters discipline.

### 7.4 Ingestion worker contract

Single SQS consumer Lambda implementing §6's pipeline with per-stage timing/cost metrics emitted to CloudWatch (`Stage`, `ModelId`, `InputTokens`, `OutputTokens` dimensions). Partial-batch failure responses (`ReportBatchItemFailures`) so one poisoned message doesn't recycle a whole batch; maxReceiveCount 3 → DLQ; the admin DLQ panel can inspect payloads and replay after a fix. All Bedrock calls carry a per-request token ceiling and the worker enforces a per-tenant daily AI-spend soft cap read from SSM (G-14's runaway-cost defense at the blast-radius level, complementing the account-level AWS Budgets alarm).

### 7.5 Encryption scope (G-16 fix)

Application-level AES-GCM-256 (KMS CMK, envelope pattern) applies to a narrow, named field list: free-text personal notes, household invite tokens at rest, exported-report URLs, and any user-entered contact names used in bill splitting. It deliberately does **not** apply to amounts, merchants, products, categories, or dates — encrypting those would destroy every aggregate query, index, and report in the product while protecting data that is meaningless without the (already access-controlled) tenant linkage. Defense for the financial rows themselves is RLS + storage-level RDS encryption + IAM auth + the SG whittle, which is proportionate to the threat model of a solo-operated consumer app.

### 7.6 Environments

`local` (LocalStack + dockerized PostgreSQL via `docker-compose.yml` + `deploy-local.sh`), `dev` and `prod` as logical databases/schemas on the shared RDS node with `-dev`/`-prod` resource suffixing and cascaded tags, exactly as v1 specified. One addition: the Stripe webhook secret and price IDs differ per environment and live in Secrets Manager alongside the DB secret coupling already described.

---

## SECTION 8 — DATA MODEL (CORE TABLES)

Tenant-scoped tables (RLS enforced via `app.current_tenant_id`; tenant = the user, or the household for household-space rows):

```
app_user            (id, cognito_sub UNIQUE, email, role ENUM(STANDARD,PREMIUM,TESTER,ADMIN),
                     status ENUM(ACTIVE,STATUS_WAITLIST,DELETED), country_code, language,
                     home_currency, region_code, price_contribution_optout BOOL DEFAULT false,
                     stripe_customer_id NULL, created_at)
household           (id, owner_user_id, name, created_at)
household_member    (household_id, user_id, joined_at, PRIMARY KEY(household_id,user_id))
invoice             (id, tenant_id, household_id NULL, uploaded_by_user_id,
                     merchant_id NULL, branch_id NULL, status ENUM(PROCESSING,NEEDS_REVIEW,
                     PARSED,FAILED_PROCESSING,SUSPECTED_DUPLICATE,DISCARDED),
                     transaction_date, currency, total, total_home_currency,
                     fx_rate_used NULL, category_id, image_s3_key, image_sha256,
                     search_tags TEXT[],          -- §6.10: ≤3 vocabulary tags, GIN-indexed
                     created_at)
invoice_line        (id, invoice_id, raw_text, product_id NULL, category_id,
                     quantity, pack_quantity NULL, base_unit NULL,
                     unit_price NULL, normalized_unit_price NULL, line_total,
                     is_discount BOOL, is_deposit_or_fee BOOL, confidence NUMERIC)
shopping_list       (id, tenant_id, name, is_active BOOL, created_at, completed_at NULL)
shopping_list_item  (id, list_id, free_text, product_id NULL, checked BOOL, position)
budget              (id, tenant_id, scope ENUM(TOTAL,CATEGORY,MEMBER), category_id NULL,
                     member_user_id NULL, amount, period ENUM(WEEK,MONTH),
                     accumulated, alert_85_fired BOOL, alert_100_fired BOOL, cycle_start)
bill_split          (id, invoice_id, created_at)  + bill_split_line(split_id, line_id,
                     participant_name_enc, fraction NUMERIC)
quota_counter       (tenant_id, counter ENUM(UPLOADS,HOUSEHOLD_UPLOADS), week_start, used,
                     PRIMARY KEY(tenant_id,counter,week_start))
ingestion_ledger    (s3_key PRIMARY KEY, tenant_id, status, attempt_count, created_at)
invoice_feedback    (id, invoice_id, tenant_id, verdict, reason NULL, comment_enc NULL,
                     model_ids_snapshot JSONB, created_at)                      -- §6.9
data_request        (id, tenant_id, kind ENUM(EXPORT,DELETION), status,
                     export_s3_key NULL, requested_at, completed_at NULL)       -- Epic 13
```

Global (no RLS): `merchant`, `merchant_branch`, `merchant_alias`, `product_category`, `product_concept`, `product`, `product_alias`, `price_observation` (§6), `fx_rate(date, base, quote, rate)`, `system_counter(name, value)` for the atomic free-user count, `migration_ledger`, `limits(role_or_user_ref, quota_name, value)` for tester/admin quota overrides, `ai_spend_ledger(tenant_id, date, model_role, input_tokens, output_tokens, est_cost)`, `tenant_trust(tenant_id, trust_score, recomputed_at)` and `tenant_signature(tenant_id, device_hash, ip_prefix_hash, first_seen_at)` (§6.8 Layer 1a), `payment_transaction(id, user_id, stripe_event_id UNIQUE, type ENUM(SUBSCRIPTION_CREATED, RENEWAL, CANCELLATION, PAYMENT_SUCCEEDED, PAYMENT_FAILED, REFUND), amount, currency, plan ENUM(MONTHLY,ANNUAL), occurred_at, raw_payload_s3_key)` (§11.3), and `kpi_daily(metric_date, metric_name, value NUMERIC, dimensions JSONB NULL, PRIMARY KEY(metric_date, metric_name, dimensions))` (§11.2). Price observations gain `quarantined BOOL DEFAULT false` and a `contributor_trust_at_write SMALLINT` weighting column (§6.8); merchants and products already carry the `status`/`created_via` columns the quarantine model relies on.

---

## SECTION 9 — REVISED EPIC BACKLOG

Epics 1–11 from v1 remain valid with the amendments noted; Epics 12–15 are new. Revised dependency order for sprint planning:

**Phase 0 — Epic 1:** Google Stitch wireframes & design system (amended: add the parse-review screen, waitlist screen, upgrade/checkout flow, and admin DLQ + alias-curation panels to the screen inventory; layout guidelines in §10 of this document are the brief).

**Phase 1 — Epic 2:** LocalStack sandbox, unchanged. **Epic 3:** CDK stacks, migrations, RLS — amended to install `pg_trgm` + `pgvector` and create the global (non-RLS) intelligence tables. **Epic 14 (pulled forward, minimal slice):** structured logging, AWS Budgets alarm at €100/month, Bedrock token metrics, and the SNS ops topic — observability is cheapest to add before features exist, and the cost alarm must predate the first AI call. The full dashboard/alarm inventory and the KPI platform that Epic 14 grows into are specified in Section 11; the nightly KPI aggregation job ships in Phase 4 once there is data worth aggregating.

**Phase 2 — Epic 4:** Cognito, federation, roles, quotas, waitlist (amended: atomic counter; quota matrix §2.4). **Epic 12 (new): Billing.** Stripe Checkout (monthly + annual prices), customer portal for self-service cancel/card-update, webhook handler (`checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`) driving role transitions with a 7-day grace state on payment failure, waitlist-bypass integration, and EU VAT handled via Stripe Tax. No invoicing UI of our own — Stripe's portal is the portal. **Transaction persistence (R-8, G-28):** the webhook handler verifies the Stripe signature, archives the raw event JSON to `s3://wobblio-billing-archive-{env}/yyyy/mm/{event_id}.json` (lifecycle: Glacier Instant Retrieval after 90 days), then upserts a normalized row into `payment_transaction` keyed on `stripe_event_id` — the unique key makes webhook redelivery naturally idempotent. Captured event types: subscription created, renewal, cancellation, payment success, payment failure, refund. The table drives MRR, churn, and conversion KPIs (§11.2) and day-to-day reconciliation; the S3 archive is the immutable audit record and is queryable ad hoc via Athena (§11.3) without ever touching the production database. Tax-relevant transaction records are retained 7 years irrespective of account deletion (Epic 13).

**Phase 3 — Epic 5:** landing page + client shells (landing-page content, copy direction, and section inventory specified in §13.2). **Epic 6:** dashboard + ingestion — substantially amended: the worker now implements the full §6 pipeline, the review screen ships as part of this epic (not later — the quality flywheel must spin from the first real user), dedup/idempotency land here, and tag generation (§6.10) ships with the worker plus the tag chip row on the review screen and the invoice-list filter chips. **Epic 15 (new): Data-intelligence foundation** runs inside/alongside Epic 6: seed data for merchants per launch country, taxonomy load, tag vocabulary load with deterministic trigger maps (§6.10.1), embedding model wiring, alias tables, price-observation emission, k-threshold read API.

**Phase 4 — Epic 7:** households (amended pooling rule). **Epic 8:** budgets, alerts, shopping lists, split-route optimizer (now implementable against §6.5.3; transaction-date budget attribution). **Epic 9:** bill splitting (printed-tax allocation rule), FX pipeline, reporting (comparison chart reads price-observation aggregates).

**Phase 5 — Epic 10:** admin console — amended to add the DLQ inspect/replay panel, alias-curation queue, AI-spend dashboard fed by `ai_spend_ledger`, and the existing SSM parameter + model-swap matrix. **Epic 11:** Day-0 security controls (continuous, verified by cdk-nag from Phase 1 onward). **Epic 13 (new): GDPR & data lifecycle:** consent capture at signup, privacy policy reflecting §6.5.4's de-identification boundary, retention schedule (original receipt images deleted from S3 after 18 months, parsed data retained until account deletion), and processor inventory (AWS, Stripe, Bedrock model providers). **Asynchronous data export (R-4, Art. 20):** `POST /me/export` inserts a `data_request(kind=EXPORT)` row and enqueues an SQS message; a dedicated export worker streams every tenant-scoped table to JSON + CSV, bundles a ZIP (including original receipt images still within retention), writes it to a dedicated, access-logged exports bucket under `{tenant_id}/{request_id}.zip`, marks the request complete, and notifies via push (SNS) and email (SES); the download endpoint returns a presigned URL valid 7 days, after which an S3 lifecycle rule deletes the object. One export request per tenant per 24h. **Two-phase account deletion (Art. 17):** phase 1, immediate on request — account status `DELETED`, Cognito tokens revoked and sign-in disabled, account invisible, household memberships detached; phase 2, after a 30-day grace window (cancel-by-signing-in is offered once during phase 1) — a purge worker hard-deletes all tenant rows, S3 images, and the Cognito identity. What survives, by design and stated in the policy: anonymized price observations (never personal data after de-identification, §6.5.4), `payment_transaction` rows retained 7 years under tax law with the user reference replaced by an opaque audit token, and a one-row deletion audit stub (hashed identifier + dates) proving the erasure was performed. Epic 13 must complete **before public launch**, not before development.

---

## SECTION 10 — UI / LAYOUT GUIDELINES (DESIGN BRIEF — NO IMPLEMENTATION)

### 10.1 Design system

**Personality:** calm, precise, financial-grade trust with consumer warmth — closer to a well-made banking app than a gamified coupon app. Numbers are the protagonist; the UI recedes.

**Color tokens (Tailwind theme):** Light: background `#FFFFFF`, surface `#F8FAFC`, text `#0F172A`, muted `#64748B`. Dark: background `#0B0F19`, surface `#111827`, text `#F1F5F9`, muted `#94A3B8`. One brand accent (suggest a confident teal/emerald family, e.g. `#0D9488`, signaling "savings/positive") used for primary actions and savings deltas; semantic colors: green `#16A34A` (under budget / saving), amber `#D97706` (85% alert, low confidence), red `#DC2626` (breach, failed parse). Never encode meaning in color alone — pair with icon or label (accessibility). Native `dark:` variant switching per v1.

**Typography:** one sans family (Inter or comparable), tight tracking on numerals, **tabular numerals (`font-variant-numeric: tabular-nums`) everywhere money appears** — this single rule does more for perceived quality in a finance app than any illustration. Scale: 30/24/20 headings, 16 body, 14 secondary, 12 captions. Currency amounts right-aligned in all tables.

**Spacing & shape:** 4px base grid; cards radius 12, buttons radius 8; 1px hairline borders in light mode, elevation-by-surface-tone in dark mode (avoid heavy shadows on `#0B0F19`). Minimalist line iconography (Lucide-class), 1.5px stroke.

**Component inventory to specify in Stitch:** stat card (label, big number, delta chip), data table (sticky header, right-aligned numerics, row drill chevron), category chip, confidence badge (dot + label: confirmed/auto/low), budget progress bar with 85% tick mark, price-history sparkline, store-comparison bar group, list item row with checkbox, photo-capture frame overlay, review side-by-side panel, empty-state pattern (every data-driven view needs one because of cold start — empty states always state *what action fills them*).

### 10.2 Mobile layout (Flutter)

**Navigation:** bottom tab bar with four tabs — Home, Lists, Insights, Profile — plus a **center-docked floating Scan button (📸)** raised above the bar: capture is the product's core action and must be reachable with one thumb from anywhere.

**Home (dashboard):** top app bar with month selector and quota chip (`7/10 scans`); then a month-to-date stat card; budget bars (premium); a "recent invoices" list where each row shows merchant logo-letter avatar, merchant, date, total, and a status pill (`Processing…` shimmer, `Needs review` amber tap-target, `Parsed`). Pull-to-refresh.

**Capture flow:** full-screen camera with receipt edge-guide overlay and torch toggle → auto-crop preview with retake/add-page (multi-page receipts) → on-device compression → upload with progress → immediately return the user to Home with the new `Processing` row; never make the user wait on parsing. Push notification on completion deep-links to the invoice or review screen.

**Review screen (critical UX):** vertically split — zoomable receipt photo on top, parsed fields below; low-confidence fields pre-highlighted amber; tapping a line opens a bottom sheet to fix product (search-as-you-type against the product table), size, or price; a tag row with removable chips and an add-tag picker over the fixed vocabulary (§6.10.4); single sticky `Confirm` button. Target: a clean receipt confirms in one tap, a messy one in under 30 seconds.

**Lists:** active lists with item counts; list detail supports offline check-off (local encrypted cache, sync on reconnect, last-write-wins per item); the `Optimize route` action (premium) renders the sub-list partition as store-grouped sections with the savings headline (“Save €7.40 across 2 stores”) and a WhatsApp share button per v1. **Insights:** mobile gets the read-only essentials — category donut, budget status, weekly advisor card — and a "open the web app for deep analysis" hand-off. **Bill split:** entry from any parsed restaurant bill; tap lines to assign to named chips; fraction stepper for shared items; proportional fees applied automatically; WhatsApp-formatted summary share sheet.

### 10.3 Web layout (Next.js)

**Frame:** sticky left vertical navigation (collapsible to icons at <1280px): Dashboard, Invoices, Reports, Shopping Lists, Budgets, Household, Settings, and Admin (visible only to `ADMIN`). Top bar: global search (invoices by tag/merchant/product), environment-agnostic quota indicator, theme toggle, avatar menu. Main content area max-width 1440 with a 12-column grid. A **collapsible right inspection drawer** (per v1) opens on row click anywhere — invoice detail, line items, original photo — without losing list context.

**Dashboard:** stat-card row (MTD spend, vs. last month delta, budget health, scans remaining); below, two-thirds/one-third split: spend-over-time area chart left, category breakdown right; recent invoices table full-width beneath.

**Reports (premium showcase):** the 3-product/6-month comparison view — product multi-select (max 3) with autocomplete, region label, one line per merchant per product with weekly-median points, discount markers, and confidence/staleness greying per §6.5.2; merchant drill-down view: pick a merchant → every product purchased there, filterable by category, with personal-price-trend sparklines.

**Invoices:** dense table (date, merchant, category, items, total, status), saved filters, tag filter chips (§6.10.6), bulk re-categorize; `NEEDS_REVIEW` rows surfaced in a banner queue. Review on web mirrors the mobile side-by-side pattern in the right drawer, including the tag chip row.

**Admin console (`/admin/*`, middleware-gated 403 per v1):** parameter editor bound to SSM (caps, thresholds, routing minimum), model-swap matrix (vision/auxiliary/embedder/insight roles, current model id, swap with confirmation), waitlist panel (count, cap, release button), DLQ panel (message inspector + replay), alias-curation queue (provisional merchants/products with approve/merge/reject), AI-spend dashboard (tokens & € by model role and day).

**Responsive & accessibility ground rules:** web must remain usable at 768px (tables collapse to card lists); WCAG AA contrast in both themes; full keyboard navigation on tables and the review drawer; all charts accompanied by data-table toggles.

---

## SECTION 11 — OBSERVABILITY, KPIs & ANALYTICS PLATFORM (R-6, R-7, R-8)

### 11.1 Monitoring & alerting (Epic 14, full inventory)

One CloudWatch dashboard per environment (`wobblio-{env}-ops`) and one SNS ops topic with an email subscription (a chat-webhook subscriber can be added later at zero architectural cost). Custom metrics are emitted via Embedded Metric Format from the existing structured logs — no metric-publishing code paths, no extra agents, and CloudWatch stays comfortably inside the budget because the custom-metric count is small and fixed.

| Area | Metric / condition | Alarm threshold (initial) |
|---|---|---|
| Ingestion | DLQ depth | > 0 for 5 min |
| Ingestion | Oldest message age, ingest queue | > 15 min |
| Ingestion | `FAILED_PROCESSING` rate | > 5% of daily ingestions |
| OCR / parse quality | Schema-validation retry rate | > 10% daily |
| OCR / parse quality | Feedback DOWN-ratio (§6.9) | > 20% daily, min 10 votes |
| Lambda | Errors per function group | > 1% over 15 min |
| Lambda | Throttles | > 0 sustained 15 min |
| API Gateway | 5xx rate | > 1% over 15 min |
| API Gateway | p99 latency | > 2 s over 15 min |
| RDS | CPU credit balance (t3-specific) | < 50 credits |
| RDS | Connections | > 60 of ~85 |
| RDS | Free storage | < 4 GiB |
| RDS | CPU utilization | > 60% sustained 1 h (scaling-ladder trigger, §7.3.1) |
| S3 / upload path | Presign-confirmed uploads with no ledger row after 30 min | > 0 |
| Auth | Cognito sign-in failure spike | > 5× 7-day baseline |
| Billing | Webhook handler errors | > 0 |
| GDPR | Export/purge job failures | > 0 |
| Cost | AWS Budgets | 50% / 80% / 100% of €100/mo |
| Cost | Cost Anomaly Detection (free) | any anomaly > €10 |
| Cost | `ai_spend_ledger` daily total | > SSM daily AI budget |

Tracing: AWS X-Ray active on API handlers and the ingestion worker only (sampled 10%) — enough to chase a latency regression across the API→SQS→worker→Bedrock chain without paying for full-fleet tracing. Log retention 30 days hot, archived to S3 thereafter.

### 11.2 Business KPI catalog & implementation (R-7, G-29)

**Implementation principle:** one nightly EventBridge cron Lambda computes all KPIs in a single pass and upserts them into `kpi_daily(metric_date, metric_name, value, dimensions)` — KPIs are read from this table, never computed live against production tables, so the admin dashboard costs one indexed read regardless of data volume. Weekly/monthly figures are roll-ups over `kpi_daily`, computed in the same job. On the first of each month, the job additionally exports the previous month's rows (plus a snapshot of `payment_transaction`) as Parquet to `s3://wobblio-analytics-{env}/kpi/yyyy/mm/`, where a Glue table definition makes the full history queryable in Athena for pennies — long-term trend analysis without ever growing the production database or running BI infrastructure. DAU/MAU source: `app_user.last_active_at`, updated at most once per hour per user by the API authorizer path (a throttled write, not a per-request write).

| Group | KPIs (all daily-grained in `kpi_daily`; weekly/monthly as roll-ups) | Source |
|---|---|---|
| Users | new registrations; total registered; DAU; MAU; waitlist size | `app_user`, counter rows |
| Subscription | new premium subs; total premium; conversion rate (premium ÷ registered); churn rate (cancellations ÷ active subs); **MRR** (active monthly plans × €2.50 + annual × €25⁄12) | `payment_transaction`, `app_user.role` |
| Invoices | total scanned (cumulative + per day); average invoices per active user; parse success rate (PARSED ÷ ingested); OCR success proxy = 1 − schema-retry rate; feedback score (UP ÷ total votes); needs-review rate; duplicate-detection rate; tag-edit rate (§6.10.4) | `invoice`, `ingestion_ledger`, `invoice_feedback` |
| Operational | average processing time per invoice (ledger created→completed); **cost per processed invoice** (day's `ai_spend_ledger` ÷ ingestions); export requests; deletion requests; quarantined-observation rate (§6.8 health) | `ingestion_ledger`, `ai_spend_ledger`, `data_request`, `price_observation` |

The admin console's KPI page (Epic 10 amendment) renders the table above as stat cards + 90-day sparklines, with a date-range picker reading `kpi_daily` directly.

### 11.3 Payment analytics & reconciliation (R-8)

`payment_transaction` (schema in §8) is the operational source of truth for revenue KPIs and support lookups; the S3 webhook archive is the immutable audit trail. A Glue/Athena external table over the archive enables ad-hoc financial queries (refund analysis, failed-payment cohorts, fee reconciliation against Stripe payout reports) with zero standing infrastructure and zero load on RDS. Monthly close procedure (manual, 10 minutes): compare Stripe's payout report against `SELECT` totals from `payment_transaction` for the month; any mismatch means a webhook was missed — replay it from the Stripe dashboard, idempotency makes the replay safe.

---

## SECTION 12 — RESOLVED DECISIONS & RISK REGISTER

### 12.1 Decisions (previously open, now made — R-5)

Per the stated constraints (minimal budget, managed/serverless, minimal ops, incremental scale), the defaults are now commitments: **Embedding model:** Amazon Titan Text Embeddings V2 at **512 dimensions** (halves pgvector storage and index size versus 1024 with negligible matching loss at this corpus size; the `product.embedding` column is `vector(512)`, and the model remains SSM-swappable — a future swap requires re-embedding the product table, a one-off batch job). **Launch market:** Netherlands, single metro (Eindhoven region) to reach price-data density fast; merchant seed list is the NL chain set from §6.2. **FX rates:** ECB daily reference rates (free, no key, stable), fetched by the daily cron with previous-day fallback. **Push delivery:** SNS mobile push with platform applications for FCM (Android) and APNs (iOS); device tokens stored per user, pruned on delivery failure. **`product_concept`:** schema ships, UI does not (phase 2). **Database engine for everything:** PostgreSQL — no DynamoDB tables despite the monitoring remark's mention; one datastore is the single biggest ops-simplicity win available, and every access pattern here is relational. **Analytics stack:** `kpi_daily` + S3 Parquet + Athena (§11.2); no Redshift, no QuickSight, no third-party analytics until a real need is demonstrated. **Infrastructure-as-code stays CDK/TypeScript; no Terraform mixing.** **Webhook/event archive lifecycle:** S3 Standard → Glacier IR at 90 days → retain 7 years.

### 12.2 Risk register

**(R1) Conversion risk** — the model lives or dies on free→premium conversion; the upgrade funnel is instrumented from day 1 (§11.2 conversion KPI) and the 4% base case is the plan, not the floor. **(R2) Parse-quality risk** — if review friction is high, users churn before contributing data; the review screen, feedback loop, and alias flywheel are the mitigation and deserve disproportionate polish, with the DOWN-ratio alarm as the early-warning system. **(R3) Data-density risk** — comparison features under-deliver in sparse regions; mitigations in §6.5.5, single-metro launch (§12.1), and per-user price history keeps the product valuable independently. **(R4) Catalog-integrity risk** — a poisoned price index would destroy the product's core trust claim; §6.8's quarantine-by-default posture means the failure mode is "new entities surface to *others* slowly" — the contributor's own experience is untouched — which is survivable, rather than "users see garbage," which is not; the Sybil-gated quorum (Layer 1a) prices coordinated fake-account attacks above any plausible payoff. **(R5) Capacity risk** — the t3.micro envelope is enforced by the waitlist cap and watched by the credit-balance alarm; the scaling ladder (§7.3.1) pre-decides every upgrade. **(R6) Solo-operator risk** — every component is managed, serverless, and alarm-instrumented precisely so the system degrades loudly rather than silently while you sleep.

---

## SECTION 13 — MARKETING USE CASES & LANDING PAGE BRIEF (NEW)

### 13.1 Personas & use cases

Six personas, each with the pain, the "Wobblio moment" (the scene marketing should dramatize), the features that deliver it, and a hook line the marketing team can adapt. All hooks share one positioning spine: **"Your receipts already contain the answers — Wobblio reads them."** Wobblio never asks for bank access, which is both a privacy promise and a differentiator worth repeating in every asset.

**P1 — The budget traveler.** *Pain:* spending abroad in three currencies, no idea what the trip actually cost until the credit-card statement lands weeks later; bank apps convert at today's rate, not the day they paid. *Wobblio moment:* photographing a Lisbon restaurant bill at the table and seeing it land in their home-currency trip budget instantly, converted at that day's rate. *Features:* AI capture, multi-currency harmonization with transaction-date FX, budgets with 85% alerts, offline lists. *Hook:* **"Three countries, one budget. Every receipt converted on the day you paid — not the day your bank felt like it."**

**P2 — The household CFO (families keeping costs under control).** *Pain:* two adults shopping in parallel, no shared picture, "who bought what and where did the grocery money go" arguments at month-end. *Wobblio moment:* both partners scan as they shop; the shared household dashboard shows the real burn rate mid-month, and the 85% alert fires *before* the budget breaks, not after. *Features:* household sync (≤5 members, pooled uploads, per-member attribution), category budgets with alerts, merchant drill-downs. *Hook:* **"One family, one picture of the money. Alerts before the budget breaks — not a post-mortem after."**

**P3 — The student.** *Pain:* fixed monthly money, invisible leaks (snacks, delivery, that one expensive supermarket next to campus), splitting everything with housemates. *Wobblio moment:* discovering they pay 22% more for the identical basket at the convenience store next door versus the supermarket two streets over — and splitting the house's cleaning-supplies receipt in two taps. *Features:* price comparison, cheapest-store resolution, bill splitting with WhatsApp export, free tier that's genuinely usable (3 scans/week covers a student's shopping). *Hook:* **"Same basket, two streets apart, 22% cheaper. Your receipts knew — now you do."**

**P4 — The inflation-conscious shopper / deal hunter.** *Pain:* "everything got more expensive" is a feeling, not data; store loyalty apps show their own prices only and never the competitor's. *Wobblio moment:* the 6-month price chart showing their coffee brand creeping +14% at their usual store while staying flat at the competitor — and the route optimizer splitting their list across both for a quantified saving. *Features:* the Anti-Inflation Price Engine (real shelf prices from real receipts, including promos no website lists), 3-product/6-month comparison, split-route lists with savings headline. *Hook:* **"Inflation is personal. See exactly which store raised which price — and shop around with proof."**

**P5 — The friend group (dinners, trips, shared everything).** *Pain:* the after-dinner spreadsheet ritual; "I didn't have wine"; tips and service fees split evenly even when orders weren't. *Wobblio moment:* one photo of the bill, tap names onto lines, fractional split on the shared starter, taxes and tip scaled proportionally automatically, summary dropped into the group chat in WhatsApp-ready format. *Features:* matrix bill splitting, proportional fee allocation (printed totals, never recomputed — correct in every country), WhatsApp export. *Hook:* **"One photo. Tap who had what. Fair split — including the tip — in your group chat in 30 seconds."**

**P6 — The border shopper / expat.** *Pain (highly relevant to the Eindhoven launch metro):* living near the NL–BE–DE border where the same products differ meaningfully across the line, with no tool that compares actual paid prices across countries and currencies. *Wobblio moment:* seeing that their monthly German drugstore run genuinely saves €23 — or that it stopped being worth the drive. *Features:* multi-currency, cross-border price history, regional comparison. *Hook:* **"Is the drive across the border still worth it? Your receipts know the real answer."**

**Messaging guardrails for all assets:** never promise prices Wobblio hasn't observed (the product itself labels data freshness and confidence — marketing must not overclaim what the cold-start §6.5.5 honesty UX then undercuts); never imply bank access or web scraping; the privacy line is always concrete: "your receipts stay yours — only anonymous price points, never your identity, feed the community price index."

### 13.2 Landing page brief (feeds Epic 5.1; design system per §10.1)

Single-page Next.js marketing site; calm financial-trust aesthetic; one accent color reserved for CTAs and savings figures; tabular numerals on every number shown. Section order and content:

**1. Hero (above the fold).** Headline candidates, in order of preference: (a) **"Scan your receipts. Outsmart inflation."** (b) "Your receipts already know where your money goes." (c) "Stop typing expenses. Start photographing them." Subline: "Wobblio reads any receipt with AI — automatic expense tracking, real local price comparison, and shopping lists that know the cheapest store. No bank access. Ever." Primary CTA `Start free`, secondary `Sign in`. Visual: a phone mockup mid-scan with the parsed line items animating out of the receipt — the capture-to-data transformation *is* the product demo. **Dynamic waitlist state (per Epic 5.1.2):** when `max_free_users_cap` is reached, the primary CTA swaps to `Join the priority waitlist` with live position framing ("2,140 people ahead of you — or skip the line with Premium"), turning the capacity guardrail into social proof.

**2. Trust strip.** Three short claims with icons: "No bank connection required" · "GDPR-compliant, EU-hosted, delete everything anytime" · "Your data stays yours — only anonymous price points are shared." This sits high deliberately: the no-bank-access promise removes the single biggest signup objection in fintech-adjacent products.

**3. How it works (3 steps).** 📸 *Snap* — photograph any receipt, even crumpled thermal paper. ✨ *Done* — AI extracts every item, price, and store in seconds; you just confirm. 📊 *Save* — budgets fill themselves, prices get compared, lists get smarter. Microcopy under step 2: "Spot a mistake? One tap fixes it — and Wobblio learns."

**4. Persona feature grid (the §13.1 six, condensed to four cards to avoid choice overload):** Families (shared household + alerts), Smart shoppers (price engine + route splitting), Friends (bill splitting → WhatsApp), Travelers (multi-currency). Each card: persona-voice headline, two-line scenario, one feature screenshot. P6 border-shopper messaging is used in regional/social campaigns rather than the global page.

**5. Price engine showcase (the differentiator gets its own full-width section).** An interactive-looking (static is fine at launch) 6-month price chart of one relatable product across two named-look stores, with the caption: "Real prices from real receipts in your area — including the in-store promos no website lists." Honest badge: "Comparisons unlock as your area's data grows — every scan makes it smarter." This converts the cold-start limitation into a community-contribution narrative instead of hiding it.

**6. Pricing table.** Two columns, Free vs Premium (€2.50/mo or **€25/yr — 2 months free**, annual visually preselected). Free column is honest and usable (3 scans/week, 3 lists, basic reports) — an obviously crippled free tier suppresses signups and the free tier's real job is seeding the price index. Premium rows: households, budgets & alerts, bill splitting, price comparison & route optimizer, multi-currency, weekly AI savings advisor. Footnote: "Cancel anytime. Subscriptions are handled on the web — no app-store markup baked into your price."

**7. FAQ (objection handling, 6 questions).** Is my financial data safe? (RLS isolation, encryption, EU hosting, no bank link) · What happens to my receipts? (images deleted after 18 months, parsed data yours until you delete it) · What's this "community price index"? (anonymous price points only — product, store, region, date; never who, never the full basket) · Does it work with receipts from any store/country? (yes — AI reading, not store integrations) · Can I export or delete everything? (one-tap export, full deletion, GDPR Art. 17/20) · Why is there a waitlist? (we grow within capacity so the experience stays fast — Premium skips the line).

**8. Final CTA + footer.** Repeat hero CTA; footer with privacy policy, terms, imprint, contact, language switcher (NL/EN at launch).

**Measurement (wires into §11.2):** the page emits funnel events (hero CTA click, pricing view, signup start/complete, waitlist join) so the conversion KPI has a top-of-funnel denominator from day one.

---

## APPENDIX A — CATALOG PROMOTION DECISION MODEL (CANONICAL REFERENCE)

This appendix is the single authoritative description of how new merchants/products enter the global catalog and how their price observations become visible. If any future change conflicts with this appendix, this appendix wins until explicitly amended. Implements §6.8; examples are normative.

### A.1 The two independent gates

A price ever shown to a non-contributing user has passed **two independent gates**, and forgetting that there are two is the most likely future confusion:

**Gate 1 — Entity promotion (per merchant/product):** `PROVISIONAL → ACTIVE`. Controls whether the entity exists in *other users'* autocomplete, charts, and the optimizer.

**Gate 2 — Observation serving (per aggregate cell, at read time):** k ≥ 3 distinct non-quarantined observations per (product, merchant, region, window), trust-weighted. Controls whether any *number* renders.

Consequence worth memorizing: **promotion alone never shows a price.** Even a fully promoted entity renders no comparison until Gate 2 is independently satisfied. This is why holding rare entities at Gate 1 costs users almost nothing — Gate 2 was always going to hold them anyway.

### A.2 Entity state machine

```
                              ┌────────────────────────────────────────────┐
                              │   eligible-corroborator quorum reached:     │
                              │   ≥3 distinct eligible tenants resolved it, │
                              │   or ≥2 eligible tenants user-confirmed it, │
                              │   or admin approves in curation queue       │
                              ▼                                            │
   receipt creates entity ──► PROVISIONAL ──────────────────────────► ACTIVE
   (creator-visible only,         │                                      │
    fully functional for          │ admin rejects / merges            admin purge
    the creator)                  ▼                                      ▼
                              REJECTED (aliases retargeted          PURGED (cascade-deletes
                              to the correct entity where           its price observations)
                              it was a duplicate/typo)
```

**Eligible corroborator (all four required):** account ≥ 7 days old · ≥ 5 successfully parsed receipts · trust score ≥ default (20) · device/IP-prefix signature distinct from every other corroborator of this entity. **Corroboration voided + cluster flagged when:** identical image SHA-256 across accounts, or identical (merchant, date, total) fingerprint across new accounts within a short window (household co-members exempt from the fingerprint rule).

### A.3 Quick decision table

| Event | Contributing user sees | Everyone else sees | System action |
|---|---|---|---|
| Receipt contains unknown product | Invoice `PARSED` immediately; item on invoice, in own autocomplete/lists; personal trend live | Nothing | Entity `PROVISIONAL`; observation `quarantined` |
| 2nd–3rd *eligible* tenant scans same product | Same as above | Nothing yet | Corroboration count rises; promotion at quorum |
| Quorum reached | No change | Product in autocomplete/charts/optimizer | `ACTIVE`; observations un-quarantine; **numbers still need k≥3 (Gate 2)** |
| Same photo from 2 accounts | Both invoices work normally | Nothing | Corroboration voided; cluster flagged to admin |
| Price wildly off median (×4 band) | Their invoice keeps *their* price as printed | Excluded from aggregates | Observation quarantined; trust −; curation review |
| User fixes a parse on review screen | Corrected immediately | Improves data quality | `USER_CONFIRMED` alias; observation upgraded |
| Admin purges fake entity | Their invoice lines fall back to raw text (`product_id NULL`) | Entity gone | Cascade delete of observations; creator trust − |

### A.4 Worked scenarios (normative examples)

**Scenario 1 — the honest long tail (your "one invoice, one item" question).** A user in Veldhoven scans a receipt from a Korean specialty grocery containing gochujang paste nobody else has ever scanned. *Outcome:* invoice `PARSED` instantly; the paste appears on their invoice, in their lists, in their personal trend ("first purchase — we'll track this for you"). Globally: provisional, invisible to others. Is anything real withheld? No — with one observation, Gate 2 could never render a comparison anyway. If the shop's other customers join later, corroboration promotes it organically; if not, it remains a perfectly functional private catalog entry forever. **There is no user-facing "pending" state in this story at any point.**

**Scenario 2 — organic promotion.** Lidl launches a new protein pudding; within ten days, six unrelated Eindhoven users (all aged, active accounts, distinct devices) scan it. *Outcome:* quorum reached around scan three; entity `ACTIVE`; by scan six, Gate 2's k≥3 is also satisfied and the price renders in comparisons region-wide. Total moderation effort: zero.

**Scenario 3 — the 3-fake-accounts attack (your question).** An attacker registers three accounts today and uploads the same fabricated receipt photo featuring "MiracleJuice €1.00" to each. *Outcome:* all three accounts fail every eligibility criterion (age 0 days, 0 prior receipts); identical SHA-256 across accounts voids corroboration anyway and flags the trio as a cluster in the admin console. Corroboration count: **zero**. The entity sits provisional, visible only inside the attacker's own accounts; its observations are quarantined twice over. Nothing reaches any real user.

**Scenario 4 — the funded attacker.** Same attacker, but patient: three accounts warmed for two weeks with five real grocery receipts each, on three devices across three networks, then three *distinct* fabricated photos of the fake product at a real merchant. *Outcome:* promotion may succeed. What they win: one fake product in autocomplete. Its €1.00 price must still pass Layer-2 plausibility (no history → category bounds; a plausible fake price is, definitionally, not very damaging), Gate 2 still demands k≥3, observations are trust-weighted, and the velocity/cluster heuristics plus the curation queue's anomaly view make it discoverable. One admin click purges it with cascade. *Recorded cost-benefit judgment:* two weeks of multi-device account farming to briefly plant one plausible price is an attack without a payoff; we defend to the proportionate bar, not the cryptographic one. Revisit if the price index ever gains commercial weight (e.g., merchants citing it).

**Scenario 5 — the household non-attack.** Two spouses in one household both scan the same Jumbo receipt (one photographed it, one got the reprint). *Outcome:* fingerprint collision detected but household co-membership exempts it; the second invoice is flagged `SUSPECTED_DUPLICATE` per §6.6 for *their own ledger hygiene* (don't double-count the budget), and they resolve it with one tap. No cluster flag, no trust penalty.

**Scenario 6 — OCR garbage.** A crumpled receipt yields the line `KSJ##FLK 0,89`, low confidence, no embedding match → provisional product with a garbage name, creator-only. *Outcome:* user opens the review screen (this invoice is `NEEDS_REVIEW` on confidence grounds — note: confidence, **not** quarantine, is what produces review states), reassigns the line to the real product; `USER_CONFIRMED` alias written, garbage entity left to be swept by a periodic job that hard-deletes provisional entities with zero references after 90 days. Catalog stays clean without anyone moderating garbage.

**Scenario 7 — the fat-finger price.** OCR reads milk at €13.90 instead of €1.39. *Outcome:* observation fails the ×4 median band → quarantined; the user's own invoice still shows €13.90 *as printed* (their ledger mirrors their receipt; if it's wrong they fix it in review, which also repairs the observation); aggregates never ingest the outlier. This filter fires far more often on OCR errors than on attackers — that's by design and is why it pays for itself immediately.

### A.5 Parameters (all SSM-tunable, initial values)

Promotion quorum 3 (confirmed-quorum 2) · corroborator age ≥ 7 days · corroborator history ≥ 5 parsed receipts · trust default 20, quarantine-only floor < 10, relaxed-band threshold > 60 · plausibility band median ×/÷ 4 (90-day window) · Gate-2 k = 3, staleness 60 days · velocity caps 10 merchants / 60 products per tenant-day · orphan-entity sweep 90 days.

---

## APPENDIX B — LLM PROMPT CONTRACTS & MODEL ASSIGNMENT (v2.4)

This appendix writes out the prompt contracts that §6 references, one per model operation. Prompts are **versioned artifacts in the repository** (`/prompts/{operation}/v{N}.txt`), loaded at worker cold-start; the active prompt version per operation is recorded alongside the model id in `invoice_feedback.model_ids_snapshot`, so the §6.9 evaluation set can attribute a regression to a prompt change as precisely as to a model swap. Treat the prompt texts below as the **v1 contracts**: the field names, enums, and output schemas are binding; the wording may be tuned (with a version bump) as evaluation data accumulates.

### B.0 Conventions (apply to every contract)

All calls go through the Bedrock Converse API (§7.1) with `temperature 0`, a per-request `max_tokens` ceiling from the table in B.7, and the per-tenant daily AI-spend soft cap of §7.4. Every prompt that expects structured output ends with the same closing instruction: *"Respond with only the JSON object. No markdown fences, no preamble, no explanation."* The worker validates output against a JSON-schema validator; on failure it retries **once** with the validation errors appended to the prompt (`Your previous response failed validation: {errors}. Emit corrected JSON only.`); a second failure routes the message per its stage's failure policy (vision parse → DLQ; merchant fallback → create provisional from the normalized raw string; expansion → lines fall through to embedding match on the raw string; classification tiebreak → merchant prior wins; tags → no tags). Model identifiers are **opaque SSM values** (G-21): the "suggested initial model" column in B.7 is a launch-day commitment, not a hard-coded dependency — the admin console's model-swap matrix changes any of them live, and the §6.9 DOWN-ratio alarm is the canary for a bad swap.

### B.1 Vision parse (stage 1, §6.1) — model role `vision_parser`

One call per receipt image (multi-page receipts: all pages in one multimodal message). Input: the client-compressed image(s) plus this system prompt:

```
You are a receipt and invoice parsing engine. You receive one or more photographs
of a single purchase document (store receipt, invoice, or restaurant bill) and
extract its contents into JSON.

Rules:
- Transcribe exactly what is printed. Never invent, infer, or "correct" values.
  If a field is not printed or not legible, use null.
- Amounts use "." as the decimal separator regardless of the printed locale.
- The date must be converted to YYYY-MM-DD. If the printed date is ambiguous
  (e.g. 03/04/05), prefer the order conventional for the document language and
  lower your parse_confidence.
- Every printed line that represents a purchased item, a deposit (e.g.
  STATIEGELD), a fee, or a discount becomes one entry in line_items, in printed
  order. Set discount_flag true for discount/refund lines (negative amounts).
- Do not compute totals yourself; report the printed total.
- parse_confidence reflects legibility and completeness: 1.0 = crisp and fully
  parsed, below 0.7 = significant uncertainty.

Output JSON schema:
{schema from §6.1, injected verbatim}

Respond with only the JSON object. No markdown fences, no preamble, no explanation.
```

The §6.1 arithmetic sanity check runs *after* the call in worker code — never delegated to the model.

### B.2 Merchant resolution fallback (§6.2 step 5) — model role `auxiliary`

Fires only when normalization, VAT lookup, exact alias, and fuzzy match have all failed — a shrinking fraction of traffic. Input is text-only:

```
You identify which merchant issued a receipt, for country {country_code}.

Receipt merchant block (raw OCR):
{raw_name} | {raw_address} | VAT: {vat_or_registration_id} | {phone}

Candidate merchants (from fuzzy matching, best first):
{id_1}: {brand_name_1} — known aliases: {aliases…}
… (up to 10)

Known national brands not in the candidates: {seed_brand_list}

Decide:
- If the receipt clearly belongs to one candidate, return its id.
- If it clearly belongs to a known national brand missing from the candidates,
  or to no known merchant at all, return "NEW_MERCHANT" with a cleaned brand
  name: proper capitalization, no legal suffixes (B.V., GmbH, Ltd), no store
  numbers, no city names.
- Never guess between two plausible candidates: if torn, return "NEW_MERCHANT"
  with your best cleaned name and confidence below 0.7 — a provisional duplicate
  is cheap to merge (Appendix A), a wrong merge is expensive.

Output JSON schema:
{"decision": "<candidate_id>|NEW_MERCHANT",
 "brand_name": "string|null",          // required when NEW_MERCHANT
 "confidence": 0.0-1.0}

Respond with only the JSON object. No markdown fences, no preamble, no explanation.
```

Confidence below the §6.7 threshold marks the invoice's merchant field for the review screen; `NEW_MERCHANT` creates a `PROVISIONAL` row per Appendix A.

### B.3 Product batch expansion + tag suggestion (§6.3 step 2, §6.10.2) — model role `auxiliary`

One call per receipt covering **all** lines that missed the merchant-scoped alias table; on fully-aliased receipts this call does not happen, and neither does any tag-suggestion cost (the deterministic path of §6.10.2 still runs). The tag vocabulary is injected as an enum; the model may use at most 3.

```
You expand abbreviated receipt line items from {merchant_brand} ({country_code},
language hint: {language}) into structured product data.

Context: "{merchant_brand}" house-brand prefixes (e.g. "AH" at Albert Heijn,
"JUMB" at Jumbo) denote the store's own brand.

Categories (choose category_id from this list only):
{two_level_taxonomy_with_ids}

Lines to expand:
{index}: "{raw_text}" | qty: {quantity} | size: {unit_size_raw} | total: {line_total}
…

Rules per line:
- Expand abbreviations into full words in the product's own language
  ("HALFV MELK" → "Halfvolle Melk"). Do not translate.
- brand: the product's brand if identifiable (house brand counts), else null.
- pack_quantity + pack_unit: parse from the size field or the text
  ("6X33CL" → 6, "33CL"). Null when absent.
- is_deposit_or_fee: true for deposits (STATIEGELD/PFAND), bag fees, service
  charges, and discount/refund lines — these get category_id null.
- Never invent a more specific product than the text supports.

Invoice-level tags: from the allowed list below, choose 0–3 tags that describe
what this purchase was for, judged from the merchant and the full set of lines.
Choose a tag only when it clearly applies; zero tags is a normal answer.
Allowed tags: {tag_vocabulary_keys}

Output JSON schema:
{"lines": [{"index": int, "brand": "string|null", "product_name": "string",
            "variant": "string|null", "pack_quantity": "decimal|null",
            "pack_unit": "string|null", "category_id": "string|null",
            "is_deposit_or_fee": bool}],
 "suggested_tags": ["tag_key", … max 3]}

Respond with only the JSON object. No markdown fences, no preamble, no explanation.
```

Worker-side: `suggested_tags` entries not present in the vocabulary are dropped silently (§6.10.2); expanded lines proceed to the embedding match of §6.3 step 3.

### B.4 Invoice classification tiebreak (§6.4) — model role `auxiliary`

Fires only when the merchant prior and the line-item vote disagree *and* no category exceeds 50% of spend — by design a rare call.

```
Assign one top-level category to this purchase.

Merchant: {merchant_brand} (default category: {merchant_prior_category})
Line summary (category: share of spend):
{category_a}: {pct}%
{category_b}: {pct}%
…
Document kind: {document_kind_hint}

Choose exactly one category_id from: {top_level_taxonomy_with_ids}

Output JSON schema: {"category_id": "string", "confidence": 0.0-1.0}

Respond with only the JSON object. No markdown fences, no preamble, no explanation.
```

### B.5 Weekly AI savings advisor (Epic 8 feature, §2.2) — model role `insight`

One call per premium user per week (EventBridge cron, §7.1), so volume is tiny and quality dominates cost — hence the mid-tier model class. The prompt receives **pre-aggregated, worker-computed numbers only** — never raw invoices, never other tenants' data, and never an instruction to compute arithmetic (the model narrates; the worker calculates):

```
You are Wobblio's weekly savings advisor. Write a short, friendly, concrete
weekly note for a user in {region_label}, in {language}. Use only the facts
below; never invent prices, stores, or products. Mention at most 3 findings,
the most valuable first. Plain text, max 120 words, no greetings, no emoji,
no financial advice beyond grocery shopping.

Facts (computed by the system, trustworthy):
- spend_this_week: {x} vs last_week: {y} ({delta_pct}%)
- budget_status: {per-budget remaining list}
- price_findings: [{product, your_price, cheapest_regional_price,
                    cheapest_merchant, observation_count}, …]   // k≥3 already enforced
- split_route_estimate: {saving, store_count} | null

Respond with only the note text.
```

The k≥3 read threshold and staleness rules of §6.5 are applied *before* facts enter the prompt — the model can never leak what the read layer would suppress.

### B.6 Embedder (§6.3 step 3) — model role `embedder` (not a prompt)

Embedding models take a string, not instructions. The binding contract is the **input formatting**, which must be byte-identical between index-time (writing `product.embedding`) and query-time, or similarity scores silently degrade:

```
{brand|""} | {product_name} | {variant|""} | {pack_quantity}{pack_unit|""} | {category_id}
```

Lowercased, single-space normalized, fields joined with `" | "`, absent fields as empty strings (separators kept so field positions stay stable). Model committed in §12.1: Amazon Titan Text Embeddings V2 at 512 dimensions; a swap requires the one-off re-embedding batch job noted there.

### B.7 Model assignment table

| # | Operation | Model role (SSM `/wobblio/config/models/…`) | Suggested initial model (opaque, swappable — G-21) | Why this class | max_tokens (out) | Frequency at steady state |
|---|---|---|---|---|---|---|
| B.1 | Vision parse | `vision_parser` | Qwen-class multimodal VLM on Bedrock (the cost driver of §3's €0.018/free-user figure); a Haiku-class multimodal model is the named swap candidate if parse quality alarms | Strong OCR-style extraction at the lowest per-image price; quality measurable via §6.9 before/after any swap | 4096 | Every ingestion |
| B.2 | Merchant fallback | `auxiliary` | Cheapest current Haiku-class small model on Bedrock | Constrained selection task over ≤10 candidates; smallest viable model | 256 | Rare and decaying (alias absorption, §6.2) |
| B.3 | Product expansion + tags | `auxiliary` (same as B.2) | Cheapest current Haiku-class small model on Bedrock | Structured expansion against a fixed enum; batched per receipt; cost decays with alias coverage (§6.3 step 4) | 2048 | Only receipts with unresolved lines |
| B.4 | Classification tiebreak | `auxiliary` (same) | Cheapest current Haiku-class small model on Bedrock | Single enum pick; fires only on prior/vote disagreement | 128 | Rare |
| B.5 | Weekly advisor | `insight` | Sonnet-class mid-tier model on Bedrock | Customer-facing prose where tone errors cost trust; weekly-per-premium volume makes the unit cost irrelevant | 512 | 1 × premium user × week |
| B.6 | Embedding | `embedder` | Amazon Titan Text Embeddings V2, 512-dim (committed, §12.1) | Decided in §12.1; pgvector storage halved at this corpus size | n/a | Unresolved lines + product creation |

One auxiliary role serves B.2–B.4 deliberately: a single small-model dependency to monitor, one swap cell in the admin matrix, and one line in `ai_spend_ledger` per concern. Per-stage `Stage`/`ModelId`/token metrics (§7.4) plus `prompt_version` in the feedback snapshot (§6.9) make every row of this table independently measurable — which is the precondition the model-swap matrix needs to stay *measurable rather than vibes-based*.

---

*End of specification (v2.4). Everything above is buildable in the order of Section 9 starting today; Phase 0–1 require no further product decisions — every previously open item is resolved in §12.1.*
