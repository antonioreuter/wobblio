# Changelog

All updates to the Wobblio OKF knowledge bundle are recorded here chronologically, with newest changes first.

## 2026-06-30

- Created `project-overview.md` to document the product vision, core features, target use cases, and business freemium model.
- Created `project-explanation.md` consolidating all product and engineering domains (features, AI pipelines, database schemas, deployment, mobile app layouts, and LLDD).
- Created `architecture/tech-stack.md` explaining software choices, version specs, database extensions (pgvector/pg_trgm), AI endpoints, and operations rationales.
- Created `architecture/environments.md` detailing tech configuration, AWS LocalStack sandbox emulators, Cognito, and Stripe test/live splits for local, dev, and prod environments.
- Created `architecture/database-schema.md` detailing the RLS-protected vs global tables schema models, field-level encryption, and GDPR de-identification boundaries.
- Created `architecture/gdpr-compliance.md` detailing user consent, retention limits, asynchronous ZIP exports, and two-phase deletion rules.
- Created `architecture/billing-integration.md` explaining Stripe web checkout, webhook ingestion, raw JSON archiving, and grace period role states.
- Created `features/quota-limits.md` documenting the credit-based soft-cap model, RLS bypass session flags, household quotas, and membership churn guards.
- Created `runbooks/troubleshooting.md` detailing setup resolution steps, cloud deployment issues, and the validation gates checklist.
- Created `architecture/mobile-client.md` defining the Flutter application layout, capture pipeline, client-side EXIF metadata stripping, and offline list LWW synchronization.
- Created `architecture/deployment.md` documenting the stateful/stateless AWS resource mapping, Lambda reserved concurrency limits, environments, and CI/CD promotion stages.
- Created `architecture/low-level-design.md` detailing low-level service mappings, invoice processing sequence flows, and domain error to HTTP code mappings.
- Updated `index.md` catalog structure to expose the new documentation nodes.

## 2026-06-24

- Created `architecture/api-integration.md` detailing Cognito auth headers, public vs. protected endpoints, and the transaction-safe 3-step invoice upload flow.
- Created `architecture/endpoints-components.md` specifying route parameters/behaviors, 12 core Hexagonal module directories, and CloudWatch metrics/alarms telemetry namespaces.


## 2026-06-23


- Initialized standard `okf/` bundle directory structure.
- Created `index.md` catalog for progressive disclosure.
- Extracted and verified core architecture specs (Hexagonal structure, database schema, multi-tenancy, and RLS rules).
- Documented data intelligence ingestion pipelines (idempotency, duplicate detection, vision parse, merchant and product canonicalization, tags).
- Documented core price engine (Price Observation Store, unit-price normalization, split-route optimizer, and Sybil-gated promotion quorum).
- Documented Weekly AI Advisor execution model and database mappings.
- Created `runbooks/ops-manual.md` to document local sandbox setups, waitlist mechanisms, curation queue functions, and low-cost CloudWatch monitoring.

