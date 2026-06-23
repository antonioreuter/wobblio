---
type: Architecture Reference
title: Hexagonal Architecture & Conventions
description: The ports & adapters structural design and clean code constraints of the Wobblio backend.
tags: [architecture, typescript, backend]
timestamp: 2026-06-23T21:52:00Z
---

# Hexagonal Architecture & Conventions

The Wobblio backend is structured using the Hexagonal Architecture (Ports and Adapters) pattern, implemented as a fleet of Node.js/TypeScript Lambdas managed via the AWS Cloud Development Kit (CDK).

## 1. Directory Structure

All source code resides in the `Source/backend/src/` directory, split into three decoupled layers:

```text
Source/backend/src/
├── core/
│   ├── domain/         # Entities, value objects, domain errors, and pure invariants
│   ├── ports/          # Typescript interfaces defining infrastructure requirements (ISP-compliant)
│   └── services/       # Core business logic services orchestrating domain & ports
├── infrastructure/
│   ├── adapters/       # Concrete adapters implementing the ports (DB, Cognito, Stripe, Bedrock, S3)
│   └── config/         # Environment variables and AWS SSM configuration loaders
├── handlers/           # Thin AWS Lambda entry points (translate API Gateway/SQS → core invocation)
└── prompts/            # Versioned LLM prompt XML templates (referencing Appendix B contracts)
```

## 2. Inward Dependency rule

* **The Golden Rule:** The domain and services layer (`src/core/`) must remain entirely isolated. It **must never** import from `src/infrastructure/`, or directly import third-party SDKs (`@aws-sdk/*`, `stripe`, `pg`, etc.).
* **Boundary Validation:** This rule is strictly enforced by the architecture validator on every build:
  ```bash
  npm run skill:hexagonal-architecture-validator
  ```
  An exit code of `0` is required for all CI/CD passes and PR merges.

## 3. Mirroring & Modularization

Directories inside `services/`, `ports/`, and `adapters/` are organized into **mirrored feature subfolders**:
* `identity/`
* `ingestion/`
* `data-intelligence/`
* `ai/`
* `billing/`
* `quota/`
* `waitlist/`
* `notifications/`
* `security/`

For example:
* Service: `core/services/ingestion/IngestionService.ts`
* Port: `core/ports/ingestion/IInvoiceRepository.ts`
* Adapter: `infrastructure/adapters/ingestion/InvoiceRepositoryAdapter.ts`

## 4. Clean Code constraints

* **Single Responsibility:** Functions must focus on one single task, keeping their length ideally under 20 lines of code.
* **Fail Fast:** Use guard clauses and return early to keep the happy path left-aligned. Avoid nesting blocks more than 2 levels deep.
* **Error Handling:** Infrastructure-specific exceptions are caught by the Adapters, mapped to specific Domain Errors (e.g. `UserNotFoundError`, `DuplicateInvoiceError`), and thrown to the core. Core services must never leak raw SDK errors.
