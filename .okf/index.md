# Wobblio Knowledge Catalog

Welcome to the Wobblio project knowledge base, organized according to the Open Knowledge Format (OKF). This catalog acts as the entry point to help developers and AI agents navigate the architecture, pipelines, and core features of Wobblio.

## Project Overview

- [Project Overview & Use Cases](./project-overview.md) - High-level project vision, core capabilities, use cases, and marketing/monetization strategy.
- [Master Project Explanation & Guide](./project-explanation.md) - Comprehensive, single-source manual mapping features, AI pipelines, use cases, database schemas, operations, architecture, and AWS components.
- [Technology Stack & Rationales](./architecture/tech-stack.md) - Complete catalog of software technologies, versions, extensions (pgvector, pg_trgm), AI models, and infrastructure.

## Architecture

- [Hexagonal Architecture & Conventions](./architecture/overview.md) - Codebase boundaries, Clean Code constraints, and directory layout.
- [Database & Multi-Tenancy](./architecture/database-multi-tenancy.md) - Postgres schema structure, Row-Level Security (RLS) enforcement, and connection management.
- [Database Schema & Entities](./architecture/database-schema.md) - Detailed entity definitions, table relationships, field-level encryption, and de-identification boundaries.
- [GDPR Compliance & Data Lifecycle](./architecture/gdpr-compliance.md) - User consent scopes, data retention limits, asynchronous ZIP exports, and two-phase deletion rules.
- [API Integration Guide](./architecture/api-integration.md) - Authorization rules, 3-step upload flows, and public endpoints contracts.
- [API Endpoints, Core Components, & Observability](./architecture/endpoints-components.md) - Public vs. restricted route definitions, 12 Hexagonal module responsibilities, and CloudWatch metrics.
- [Mobile Client Architecture](./architecture/mobile-client.md) - Flutter mobile app design, edge detection capture flow, image optimization, and offline checklist caching.
- [Cloud Infrastructure & Deployment](./architecture/deployment.md) - AWS service stack, CDK stack division, Lambda connection limits, and CI/CD promotion pipelines.
- [Target Environments (Local, Dev, Prod)](./architecture/environments.md) - Configuration matrices, AWS LocalStack sandbox emulators, Cognito settings, and Stripe test/live splits.
- [Stripe Billing & Subscription Integration](./architecture/billing-integration.md) - Web-only deep links, Stripe webhooks, raw JSON archiving in S3, and role transitions.
- [Low Level Design (LLD)](./architecture/low-level-design.md) - Service-to-adapter maps, detailed invoice processing sequence, and domain-to-HTTP error codes.

## Ingestion & Pipelines

- [Ingestion Pipeline](./pipelines/ingestion-pipeline.md) - End-to-end receipt ingestion: vision parsing, deduplication, merchant canonicalization, product normalization, classification, and tag generation.

## Feature Specifications

- [Anti-Inflation Price Engine](./features/price-engine.md) - Price matrix resolution, regional comparison indices, unit-price normalization, and the split-route optimizer.
- [Weekly AI Savings Advisor](./features/weekly-advisor.md) - Bounded multi-tenant advisor crons, model assignments, and data aggregation formats.
- [Quotas, Credits, & Household Limits](./features/quota-limits.md) - Credit-based soft-caps, admin RLS bypass configurations, household quotas, and membership churn guards.

## Operations & Administration

- [Operations & Runbook](./runbooks/ops-manual.md) - Local sandbox setup, database migrations, waitlist controls, and CloudWatch metrics.
- [Troubleshooting & Validation Guide](./runbooks/troubleshooting.md) - Step-by-step local and cloud issue resolution checklists, DLQ redrive, and verification gates.
- [Testing Strategy & Scenarios](./runbooks/testing-strategy.md) - Architectural test levels (Unit, Integration, E2E) and step-by-step verification flows for business invariants.
