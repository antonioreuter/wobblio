---
trigger: always_on
---

# Code Quality & Architecture Guard

Specialized guardrails for refactoring, SOLID principles adherence, Clean Code validation, and enforcing Hexagonal Architecture constraints.

## Objective

To maintain strict separation of concerns, ensuring that the core business logic remains entirely isolated from external frameworks, databases, and third-party SDKs (AWS Bedrock, Cognito, S3), while keeping the codebase highly maintainable, testable, and readable.

---

## 1. Code Economy & Abstraction Principles

To keep the codebase lean while avoiding the traps of premature optimization, apply these three rules of thumb:

* **DRY (Don't Repeat Yourself):** Every piece of knowledge or business logic must have a single, unambiguous, authoritative representation within the system. Duplicate domain logic (like calculating a pricing metric in two different services) must be unified.
* **AHA (Avoid Hasty Abstractions):** Prioritize clarity over abstract code. Duplicating a few lines of simple, localized code is significantly cheaper than maintaining the wrong abstraction. Do not create complex generic wrappers until patterns are well-established.
* **The Rule of Three (WET - Write Everything Twice):** You are allowed to write code twice. The third time you find yourself writing the same logic, it is time to abstract it into a shared utility, a common component, or a domain-level helper.
* **YAGNI (You Aren't Gonna Need It):** Never implement functionality, ports, or adapters based on hypothetical future requirements. Only build what is explicitly required by the current user stories.

---

## 2. Clean Code Standards

Every code modification must adhere to these baseline readability and maintainability metrics:

* **Function Length & Focus:** Functions should do one thing, do it well, and do it exclusively. Aim for functions under 20 lines of code.
* **Descriptive Naming:** Avoid generic names (`data`, `handle`, `process`). Use intention-revealing names.
* *Bad:* `void function handleUser(u: User)`
* *Good:* `void function registerNewOrganizationMember(user: User)`


* **Fail Fast (Guard Clauses):** Return early from a function instead of nesting `if` statements. Keep the "happy path" left-aligned.
* **Error Handling:** Never swallow errors. Catch infrastructure errors in the Adapters, map them to explicit Domain Errors (e.g., `UserNotFoundError`), and throw those from the Core.

---

## 3. SOLID Principles in Antigravity 2.0

| Principle | Antigravity 2.0 Implementation Guide |
| --- | --- |
| **S**ingle Responsibility (SRP) | A class or module should have one, and only one, reason to change. Separate orchestration logic (Domain Services) from pure business rules (Domain Entities). |
| **O**pen/Closed (OCP) | Code should be open for extension, but closed for modification. For instance, if you add a new LLM provider alongside Bedrock, you should be able to drop in a new Adapter without touching your core domain logic. |
| **L**iskov Substitution (LSP) | Any adapter implementing a Port must fulfill the interface contract completely. Subclasses or interface implementations must be interchangeable without breaking the application state. |
| **I**nterface Segregation (ISP) | Keep Ports lean. Do not create a massive `IInfrastructurePort`. Instead, split them by domain capability: `IBedrockChatClient`, `IS3FileStorage`, `ICognitoIdentityManager`. |
| **D**ependency Inversion (DIP) | High-level modules (Domain) must not depend on low-level modules (Adapters). Both must depend on abstractions (Ports). *This is the foundational law of Hexagonal Architecture.* |

---

## 4. Architectural Constraints

### Core Domain Isolation

* All business logic and domain rules **must** reside exclusively inside the core domain services (e.g., `src/core/services/`).
* Domain services must be framework-agnostic and contain zero infrastructure-specific code or types.

### Dependency Inversion via Ports & Adapters

* **Ports (Interfaces):** All external capabilities—including database access, Cognito user management, AWS Bedrock LLM calls, and S3 file operations—**must** be defined as TypeScript interfaces inside `src/core/ports/`.
* **Adapters (Implementations):** The concrete implementations of these ports must live strictly within `src/infrastructure/adapters/`.

### Strict Import Directionality

* **The Golden Rule:** Dependencies must only point inward.
* Domain services (`src/core/`) **must never** import from adapters or infrastructure layers (`src/infrastructure/`).
* Violations will immediately fail CI/CD checks.

---

## 5. Verification & Validation Workflow

Every refactoring task or code modification must pass the following verification pipeline before a Pull Request can be opened:

### Step 1: Static Architecture Check

Run the automated validation script to ensure no boundary violations exist:

```bash
npm run skill:hexagonal-architecture-validator

```

### Step 2: Regression Testing & Coverage

Execute the backend unit test suite to verify code correctness and SOLID compliance:

```bash
cd backend && npm run test:unit

```

> **Test Coverage Requirement:** All new domain logic must achieve 100% test coverage using Vitest. Rely heavily on mocking the defined ports—do not spin up real AWS SDKs or databases in unit tests.

---

## 6. Definition of Done (DoD) Checklist

Before submitting code for review, verify that:

* [ ] No infrastructure-specific SDKs (`@aws-sdk/client-bedrock`, `aws-jwt-verify`, etc.) are imported inside `src/core/`.
* [ ] No function nests `if` statements more than 2 levels deep.
* [ ] Code avoids premature abstractions, opting to follow the **Rule of Three** for code reuse.
* [ ] The `hexagonal-architecture-validator` script returns a `0` exit code.
* [ ] All code paths are covered by mock-driven Vitest unit tests.