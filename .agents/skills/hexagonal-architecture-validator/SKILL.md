---
name: hexagonal-architecture-validator
description: Automatically scans the codebase imports to enforce Hexagonal Architecture boundaries.
---

# Hexagonal Architecture Validator

Verify that the TypeScript backend and Dart/Flutter mobile client adhere strictly to the rules of Hexagonal Architecture (Ports and Adapters).

## Description
This skill automates checking that core business logic is kept decoupled from infrastructure details. It scans the imports in domain code to prevent leaky abstractions.

## How to Use
Run the validation script using npm inside the backend directory:
```bash
cd Source/backend && npm run skill:hexagonal-architecture-validator
```

## Details
* Script Location: `.agents/skills/hexagonal-architecture-validator/scripts/validate-hexagonal.ts`
