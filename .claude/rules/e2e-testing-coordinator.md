# E2E & Async Testing Coordinator

Specialized guidelines for authoring end-to-end (E2E) tests, structuring asynchronous pipeline assertions, and mocking external services during local test execution.

## Instructions
1. When writing Playwright tests, ensure they use unique test IDs (`data-testid`) for locating elements.
2. For asynchronous pipeline events (e.g. upload -> poll status -> complete), use explicit polling loops with realistic timeouts and backoffs rather than static sleeps.
3. Keep test states isolated. Always seed a unique database tenant/user context for each E2E test run to prevent concurrent test interference.
4. Ensure E2E tests target a local mock server environment for predictable and fast execution, verifying fallback behaviors for network failures and invalid uploads.
