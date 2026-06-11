---
name: automatic-test-runner
description: Runs relevant tests (Vitest, Playwright, Flutter test) when code changes are made.
---

# Automatic Test Runner

Ensure that all test suites are executed when files are modified, validating that the application runs regression-free and maintains high test coverage.

## Description
This skill automates executing local test suites (Vitest/Jest, Playwright, Flutter test) when code changes are made.

## How to Use
Run the tests using npm inside the backend directory:
```bash
npm run test
```
To run tests with coverage reporting:
```bash
npm run test:coverage
```
