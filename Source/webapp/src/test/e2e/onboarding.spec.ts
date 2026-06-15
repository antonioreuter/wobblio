import { test, expect } from '@playwright/test'
import { register, completeOnboarding, uniqueEmail } from './helpers/flows'
import { getOnboarded, deleteUser, closeDb } from './helpers/db'

// The regression test for the bug that bit us repeatedly: completing onboarding
// the first time must land on /dashboard and STAY there (no /onboarding ↔
// /dashboard loop, even though the session token's onboarded flag can't be
// refreshed mid-session under SSR).
test.describe('onboarding completion', () => {
  test.afterAll(async () => {
    await closeDb()
  })

  test('a new user completes onboarding and stays on the dashboard (no loop)', async ({ page }) => {
    const email = uniqueEmail()
    await register(page, email)

    // Fresh registration lands on onboarding (DB onboarded_at is null).
    await expect(page).toHaveURL(/\/onboarding$/)

    await completeOnboarding(page)

    // DB is the source of truth — confirm it was actually marked onboarded.
    expect(await getOnboarded(email)).toBe(true)

    // The gate must keep us on the dashboard. Poll briefly to catch a bounce
    // back to /onboarding (the loop) rather than asserting once.
    await expect.poll(async () => new URL(page.url()).pathname, { timeout: 4000 })
      .toBe('/dashboard')
    await page.waitForTimeout(1500)
    expect(new URL(page.url()).pathname).toBe('/dashboard')

    // Role badge renders from the DB-sourced role.
    await expect(page.getByTestId('topbar-plan')).toContainText('Standard')

    await deleteUser(email)
  })
})
