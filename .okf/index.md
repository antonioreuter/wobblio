# Wobblio Knowledge Catalog

Welcome to the Wobblio project knowledge base, organized according to the Open Knowledge Format (OKF). This catalog acts as the entry point to help developers and AI agents navigate the architecture, pipelines, and core features of Wobblio.

## Architecture

- [Hexagonal Architecture & Conventions](/architecture/overview) - Codebase boundaries, Clean Code constraints, and directory layout.
- [Database & Multi-Tenancy](/architecture/database-multi-tenancy) - Postgres schema structure, Row-Level Security (RLS) enforcement, and de-identification boundaries.
- [API Integration Guide](/architecture/api-integration) - Authorization rules, 3-step upload flows, and public endpoints contracts.
- [API Endpoints, Core Components, & Observability](/architecture/endpoints-components) - Public vs. restricted route definitions, 12 Hexagonal module responsibilities, and CloudWatch metrics.



## Ingestion & Pipelines

- [Ingestion Pipeline](/pipelines/ingestion-pipeline) - End-to-end receipt ingestion: vision parsing, deduplication, merchant canonicalization, product normalization, classification, and tag generation.

## Feature Specifications

- [Anti-Inflation Price Engine](/features/price-engine) - Price matrix resolution, regional comparison indices, unit-price normalization, and the split-route optimizer.
- [Weekly AI Savings Advisor](/features/weekly-advisor) - Bounded multi-tenant advisor crons, model assignments, and data aggregation formats.

## Operations & Administration

- [Operations & Runbook](/runbooks/ops-manual) - Local sandbox setup, database migrations, waitlist controls, and CloudWatch metrics.

