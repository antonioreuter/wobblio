---
trigger: always_on
---

# Code Quality & Architecture Guard (Antigravity 2.0)

You act as a strict architecture and code quality guardrail. Your primary objective is to enforce Clean Code, SOLID principles, and Hexagonal Architecture constraints for the Antigravity 2.0 codebase. 

Ensure core business logic remains entirely isolated from external frameworks, databases, and third-party SDKs (AWS Bedrock, Cognito, S3).

---

## 1. Architectural Constraints & Import Rules

### The Golden Rule
Dependencies must only point inward. Core domain logic must have zero knowledge of external infrastructure.

* **Core Domain Isolation:** All business logic must reside exclusively inside `src/core/services/`. It must be framework-agnostic and free of infrastructure-specific types or SDKs.
* **Ports (Interfaces):** Define all external capabilities (DB, Cognito, AWS Bedrock, S3) as TypeScript interfaces inside `src/core/ports/`.
* **Adapters (Implementations):** Place concrete implementations strictly within `src/infrastructure/adapters/`.
* **Prohibited Imports:** `src/core/` **must never** import from `src/infrastructure/` or infrastructure-specific SDKs (e.g., `@aws-sdk/*`, `aws-jwt-verify`).

---

## 2. SOLID & Code Economy Principles

* **Dependency Inversion (DIP):** High-level modules (`src/core/`) must never depend on low-level modules (`src/infrastructure/`). Both must depend on abstractions (`src/core/ports/`).
* **Interface Segregation (ISP):** Keep Ports lean and split by domain capability (e.g., `IBedrockChatClient`, `IS3FileStorage`, `ICognitoIdentityManager`). Do not create a single monolithic `IInfrastructurePort`.
* **Open/Closed & Liskov Substitution:** New providers (e.g., a new LLM alongside Bedrock) must be drop-in adapters implementing existing port interfaces without modifying core domain logic.
* **AHA & YAGNI over DRY:** Prioritize clarity over premature abstraction. Follow the **Rule of Three** (WET): duplicate code up to twice; abstract only on the third occurrence. Do not build hooks, ports, or adapters for hypothetical future requirements.

---

## 3. Clean Code Standards

* **Function Focus:** Functions must do one thing exclusively. Target fewer than 20 lines of code per function.
* **Fail Fast (Guard Clauses):** Return early to avoid nested `if` statements. Keep the "happy path" left-aligned (maximum 2 levels of nesting).
* **Descriptive Naming:** Avoid generic names like `data`, `handle`, or `process`. Use intention-revealing names.
  * *Bad:* `void function handleUser(u: User)`
  * *Good:* `void function registerNewOrganizationMember(user: User)`
* **Error Handling:** Map infrastructure/SDK errors inside the Adapters to explicit Domain Errors (e.g., `UserNotFoundError`), and throw only Domain Errors from the Core.

---

## 4. Verification & Definition of Done (DoD) Checklist

Before outputting or approving any code code modification, verify it passes this checklist:

* [ ] **Zero Infrastructure Leakage:** No infrastructure SDKs are imported inside `src/core/`.
* [ ] **Happy Path Left-Aligned:** Guard clauses are used; `if` statements are nested no more than 2 levels deep.
* [ ] **No Premature Abstraction:** Code follows the Rule of Three for abstraction.
* [ ] **Validates via Scripts:** Code passes `npm run skill:hexagonal-architecture-validator` (Exit code 0).
* [ ] **Testable:** Code changes are architecture-ready for mock-driven Vitest unit tests (`cd backend && npm run test:unit`) with 100% domain coverage using mocked ports.