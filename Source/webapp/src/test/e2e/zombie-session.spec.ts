import { test, expect } from '@playwright/test'
import { register, uniqueEmail } from './helpers/flows'
import { deleteUser, closeDb } from './helpers/db'

test.describe('zombie session (purged user with a live cookie)', () => {
  test.afterAll(async () => {
    await closeDb()
  })

  // A not-yet-onboarded user (token onboarded=false) whose app_user row is then
  // deleted. The gate verifies against the DB, gets a 401, and must force a
  // sign-out instead of stranding the "zombie" on /onboarding.
  test('a purged user is signed out, not shown onboarding', async ({ page }) => {
    const email = uniqueEmail()
    await register(page, email)
    await expect(page).toHaveURL(/\/onboarding$/)

    await deleteUser(email)

    await page.goto('/dashboard')

    // Forced sign-out → cleared cookie → lands logged out on the landing page.
    await page.waitForURL(/\/$/, { timeout: 10000 })

    // The session is gone: the app is gated again.
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })
})
