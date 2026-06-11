---
name: automatic-test-runner
description: Token-efficient install + test workflow for wobblio's Node/TypeScript workspaces. Use before npm install/ci, npm test, npm run test:unit, test:coverage, validate:security, skill:hexagonal-architecture-validator, cdk synth, Vitest, Jest, Playwright, lint, or typecheck after code changes or while diagnosing failures.
---

# Automatic Test Runner

Use the narrowest verification that yields useful evidence. Send full logs to `/tmp`; let only summaries and actionable errors into the conversation.

## Workspaces

Every folder with a `package.json` is a workspace (e.g. `Source/backend/`, `Source/webapp/`, `Source/admin-app/`, plus CDK packages). `cd` into the workspace owning the changed file and read its `package.json` before assuming a script exists.

## Decide before running

- Match the package manager to the lockfile (npm/pnpm/yarn). Wobblio uses npm.
- Skip installs unless deps changed, `node_modules` is missing, or the failure says so.
- Pick the smallest reliable target: changed test file → colocated tests → framework related-tests (`--changed`, `--findRelatedTests`) → workspace suite → full repo.

## Bounded execution

Quiet installs and tests; redirect noise to `/tmp`, tail on failure:

```bash
npm ci --silent > /tmp/npm-install.log 2>&1 || tail -120 /tmp/npm-install.log
npm run test:unit -- path/to/file.test.ts > /tmp/node-test.log 2>&1 || tail -160 /tmp/node-test.log
```

If the tail misses the real failure, grep the log instead of dumping it:

```bash
rg -n "FAIL|failed|Error:|Assertion|Expected|Received|Caused by" /tmp/node-test.log
```

Avoid watch, verbose, coverage, snapshot updates, browser UI, and full E2E unless explicitly needed.

## Keep in context (only)

Pass/fail summary, failing suite + test names, assertion diffs, project-file stack frames, missing-module/syntax/type/timeout/env errors. Drop progress bars, passing lists, coverage tables, repeated warnings.

## Escalate when

- Scoped tests pass but the change touches shared utilities, ports/adapters, config, build tooling, exports, or public APIs.
- **DDL migrations or DB adapters changed** → `npm run validate:security`.
- **Core domain or ports/adapters changed** → `npm run skill:hexagonal-architecture-validator` (exit 0).
- **CDK stacks changed** → `cdk synth` (must pass `cdk-nag`).
- Lockfile/test-config change spans packages, failures hint at hidden coupling, or the user asks for full verification.

Order: scoped → workspace suite → lint/typecheck → validators → full repo.

## Report

Exact command (with cwd), result with counts, concise error excerpt or pass summary, and what broader verification was skipped and why.
