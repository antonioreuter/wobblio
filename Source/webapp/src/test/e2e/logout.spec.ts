import { test, expect } from '@playwright/test'
import { register, completeOnboarding, uniqueEmail } from './helpers/flows'
import { deleteUser, closeDb } from './helpers/db'

test.describe('logout', () => {
  test.afterAll(async () => {
    await closeDb()
  })

  // Note: the federated Cognito /logout (clearing the IdP SSO cookie) only runs in
  // dev/prod; locally /api/auth/cognito-logout short-circuits to '/'. This test
  // covers the local path — the app session is cleared and the app is gated again.
  test('signing out clears the session and re-gates the app', async ({ page }) => {
    const email = uniqueEmail()
    await register(page, email)
    await completeOnboarding(page)
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.getByTestId('user-menu-trigger').click()
    await page.getByTestId('signout-button').click()
    await page.getByTestId('signout-confirm').click()

    // Lands on the marketing landing page, logged out.
    await page.waitForURL(/\/$/)

    // The app is gated again: visiting /dashboard now redirects to /login.
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)

    await deleteUser(email)
  })
})
