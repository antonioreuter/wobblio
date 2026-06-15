import { test, expect } from '@playwright/test'
import { register, login, completeOnboarding, uniqueEmail } from './helpers/flows'
import { deleteUser, closeDb } from './helpers/db'

test.describe('login routing by onboarding state', () => {
  test.afterAll(async () => {
    await closeDb()
  })

  test('a registered, not-yet-onboarded user is routed to /onboarding on login', async ({ page }) => {
    const email = uniqueEmail()
    await register(page, email) // lands on /onboarding with an active session
    await page.context().clearCookies() // drop it so we exercise a fresh login

    await login(page, email)
    await expect(page).toHaveURL(/\/onboarding$/)

    await deleteUser(email)
  })

  test('an onboarded user lands on /dashboard on login (no bounce)', async ({ page }) => {
    const email = uniqueEmail()
    await register(page, email)
    await completeOnboarding(page)
    await page.context().clearCookies() // drop the active session to log in fresh

    await login(page, email)
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.waitForTimeout(1000)
    await expect(page).toHaveURL(/\/dashboard$/)

    await deleteUser(email)
  })
})
