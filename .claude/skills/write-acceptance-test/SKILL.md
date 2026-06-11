---
name: write-acceptance-test
description: Guidelines and template structures for writing end-to-end (E2E) acceptance tests using Playwright.
---

# Write Acceptance Test Skill

Use this skill when you need to write acceptance or end-to-end (E2E) tests to verify complete user flows across the user interfaces (Next.js web client, Flutter mobile client) and the API.

## Architecture Guidelines
1. **Target Web Element Hooks**: Target interactive elements using robust test selectors (like `data-testid`) instead of brittle class selectors or text strings that can change.
2. **Page Object Models (POM)**: Implement page object classes to cleanly encapsulate page locators and user interactions (e.g. `LoginPage`, `DashboardPage`).
3. **Simulate Async Transitions**: Use Playwright's built-in wait functions (`waitForSelector`, `waitForResponse`, `waitForNavigation`) to cleanly synchronize testing scripts with animations, uploads, and server polling.
4. **Mocked API vs Real API**: Run tests against a local frontend build linked to a mock backend API when verifying interface components in isolation. Run against a staging/sandbox server environment when executing complete E2E system integration checks.

## Standard E2E Test Skeleton (Playwright)
```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { DashboardPage } from './pages/dashboard.page';

test.describe('Invoice Comparator E2E Flow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    
    // Navigate and sign in
    await loginPage.navigate();
    await loginPage.login('user@example.com', 'SecurePass123!');
  });

  test('should successfully upload an invoice and display it in the drawer', async ({ page }) => {
    // 1. Verify redirected to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(dashboardPage.welcomeHeader).toContainText('John Doe');

    // 2. Mock or drop receipt image onto upload component
    await dashboardPage.uploadInvoice('tests/fixtures/receipt.png');

    // 3. Verify upload progress animation starts
    await expect(dashboardPage.uploadProgress).toBeVisible();

    // 4. Wait for processing pipeline polling to complete and status to set to 'PROCESSED'
    await dashboardPage.waitForInvoiceStatus('PROCESSED', 30000); // 30s timeout

    // 5. Click on the recent invoice row to open detail drawer
    await dashboardPage.invoiceRows.first().click();

    // 6. Assert detail fields display correctly
    await expect(dashboardPage.detailDrawer).toBeVisible();
    await expect(dashboardPage.drawerStoreName).toHaveText('Walmart');
    await expect(dashboardPage.drawerTotalAmount).toHaveText('$45.50');
    await expect(dashboardPage.drawerItemsCount).toHaveText('3 items');
  });
});
```
