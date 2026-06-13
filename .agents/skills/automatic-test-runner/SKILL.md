---
name: automatic-test-runner
description: Token-efficient install + test workflow for wobblio's Node/TypeScript workspaces. Use before npm install/ci, npm test, npm run test:unit, test:coverage, validate:security, skill:hexagonal-architecture-validator, cdk synth, Vitest, Jest, Playwright, lint, or typecheck after code changes or while diagnosing failures.
---

# Automatic Test Runner

Routes to the right test suite based on what changed. Run this after every code change before committing.

## Step 1: Detect Changed Files

```bash
git diff --name-only HEAD
```

## Step 2: Route to the Right Suite

| Changed path pattern | Command to run | Directory |
|---|---|---|
| `Source/backend/src/core/**` | `npm run test:unit` | `Source/backend` |
| `Source/backend/src/infrastructure/adapters/**` | `npm run test:unit` + `npm run validate:security` | `Source/backend` |
| `Source/infra/db/migrations/**` | `npm run validate:security` | `Source/backend` |
| Bedrock prompt files (`*prompt*`, `*bedrock*`) | `npm run validate:prompts` | `Source/backend` |
| `Source/webapp/src/**` | `npm run typecheck && npm run lint` | `Source/webapp` |
| Any backend change | `npm run skill:hexagonal-architecture-validator` | `Source/backend` |
| CDK stacks (`Source/infra/**`) | `cdk synth` | `Source/infra` |

Run multiple rows when multiple patterns match — run them in parallel where possible.

## Step 3: Full Suite (before PR / after major change)

```bash
# Backend
cd Source/backend
npm run test:unit
npm run test:coverage        # must stay above 85%
npm run validate:security
npm run skill:hexagonal-architecture-validator

# Webapp
cd Source/webapp
npm run typecheck
npm run lint
npm run build
```

## Rules

- Never run `npm install` or `npm ci` unless package.json changed.
- Always run `skill:hexagonal-architecture-validator` when any backend file changes.
- A RED test is a blocker — do not commit until GREEN.
- Coverage below 85% on core domain services is a blocker.
