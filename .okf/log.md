# Changelog

All updates to the Wobblio OKF knowledge bundle are recorded here chronologically, with newest changes first.

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

