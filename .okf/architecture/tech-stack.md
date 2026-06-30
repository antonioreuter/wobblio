---
type: Architecture Reference
title: Technology Stack & Rationales
description: Detailed catalog of technologies, versions, configuration roles, and architectural rationales for backend, frontend, database, mobile, and AI layers.
tags: [architecture, tech-stack, nodejs, postgres, bedrock, flutter, nextjs]
timestamp: 2026-06-30T22:59:00Z
---

# Technology Stack & Rationales

Wobblio uses a cloud-native, serverless stack designed for cost containment, scalability, and strict tenant isolation. This document explains the technologies, versions, and architectural decisions behind each layer of the application.

---

## 1. Web & Mobile Frontend Layers

### 1.1 Web App Command Center (Next.js 14+ & Tailwind CSS)
* **Role:** Serves as the primary user command center (dense reports, comparison charts, billing portal) and administrative console.
* **Architecture:** Deployed as serverless functions using **OpenNext** to wrap Next.js Server-Side Rendering (SSR) and assets for CloudFront and Lambda.
* **Styling:** Styled using **Tailwind CSS** with native dark mode toggling. It utilizes **tabular numerals** (`font-variant-numeric: tabular-nums`) across all financial tables to guarantee clean visual alignment of currency values.

### 1.2 Mobile Client (Flutter & Dart)
* **Role:** The primary "capture-first" client for scanning receipts, managing shopping lists offline, and splitting restaurant bills.
* **Architecture:** Uses a bottom-navigation model with a central, raised floating action button (FAB) triggering the camera.
* **Local Storage:** Leverages an encrypted local SQLite database (via **Drift/Sqflite**) to support offline shopping checklist updates and checkoffs with a Last-Write-Wins (LWW) conflict resolution algorithm.
* **GDPR Prep:** Performs on-device image cropping, compresses raw captures to JPEGs $\le 1$MB, and strips EXIF metadata (GPS location, camera footprints) on-device before uploading to S3.

---

## 2. Serverless Backend & IaC Layers

### 2.1 Backend Fleet (Node.js 24 & TypeScript 5.5)
* **Role:** Runs the API Gateway endpoints (Lambda fleet), SQS background workers, and scheduled crons.
* **TypeScript compilation:** Strict compiler mode enforces Clean Code boundaries. The codebase implements Hexagonal Ports & Adapters; the compiler and validator check that core business services have no direct dependencies on AWS SDKs, Postgres libraries, or external APIs.

### 2.2 Infrastructure as Code (AWS CDK & TypeScript)
* **Role:** Manages all cloud resources via programmatic stacks.
* **Stack Divisions:** Separated into `WobblioStatefulStack` (VPC, RDS Postgres, S3 buckets, Cognito User Pools, and KMS key rings) and `WobblioAppStack` (Lambda functions, API Gateway, SQS queues, EventBridge crons, and alarms).
* **Validation Gating:** The CDK compilation outputs are audited via **cdk-nag** to block deployment of open subnets, wildcards, or unencrypted storage.

---

## 3. Database Layer (PostgreSQL 15 on RDS db.t3.micro)

Wobblio avoids expensive dedicated database licenses and specialized vector storage by concentrating its data layer on PostgreSQL 15 with key extensions:

* **pgvector:** Used to store and query 512-dimensional titan product embeddings. Leverages HNSW indexing to support fast cosine similarity checks directly inside SQL queries without incurring the cost of a standalone vector database.
* **pg_trgm:** Enables trigram-based fuzzy string matching. This is used in merchant and product canonicalization to resolve OCR receipt text against catalog aliases.
* **Row-Level Security (RLS):** Isolates tenant-scoped rows using a session variable:
  ```sql
  CREATE POLICY tenant_isolation ON invoice
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
  ```
  Every Lambda API handler executes `SET LOCAL app.current_tenant_id` before querying.

---

## 4. Artificial Intelligence & Vision (AWS Bedrock Converse API)

AI operations are handled via AWS Bedrock Converse APIs. Model selection is handled dynamically using pointers stored in AWS SSM Parameter Store:

* **Vision Parser (SSM `/wobblio/config/models/vision_parser`):** Typically mapped to **Qwen-class** multimodal models to extract JSON fields from compressed receipt images.
* **Auxiliary Resolver (SSM `/wobblio/config/models/auxiliary`):** Mapped to **Haiku-class** models to handle low-cost canonicalization fallbacks, category tiebreaks, and tag generation.
* **Embedding Model (SSM `/wobblio/config/models/embedder`):** Mapped to **Titan Text Embeddings V2** (configured to output 512 dimensions) to generate vector embeddings for catalog matching.
* **Insights Generator (SSM `/wobblio/config/models/insights`):** Mapped to **Sonnet-class** models for compiling the Weekly AI Savings Advisor aggregates.

---

## 5. Security, Identity, & Billing integrations

* **AWS Cognito:** Handles authentication, federation with Google and Meta, OIDC JWT generation, and token refresh operations. Custom pre-signup hooks enforce waitlists and free-tier caps before account creation.
* **AWS KMS:** Manages customer keys used for AES-GCM envelope encryption. This is applied strictly to high-PII text fields: free-text personal notes, household invite tokens, exported-report URLs, and split participant names.
* **Stripe Checkout & Customer Portal:** Handles B2C monetization. Subscriptions are billed on the web app only. Stripe webhooks (`checkout.session.completed`, etc.) handle plan transitions. Events are archived as raw JSON in S3 for auditing.

---

## 6. Observability, Logging, & Testing

* **Pino Logger:** Outputs structured JSON logging directly to stdout, which is aggregated by AWS CloudWatch.
* **Logs Insights:** Avoids expensive custom CloudWatch metrics by using a nightly EventBridge cron (`cron-ingestion-metrics-rollup`) to run Log Insights queries, rolling up daily tokens, costs, durations, and quota blocks into `kpi_daily`.
* **Vitest 2.0:** Runs the backend unit test suite, utilizing mock adapters to run tests with zero network dependencies.
* **LocalStack:** Serves as the local AWS environment emulator.
