import { test, expect, type Page } from '@playwright/test'
import { register, login, completeOnboarding, uniqueEmail } from './helpers/flows'
import { deleteUser, setRole, closeDb } from './helpers/db'

// End-to-end household lifecycle against the local stack: a Premium owner creates
// a household, mints an invite, a second user joins via the link, and the owner
// removes them. Per the e2e rules: data-testid selectors, polling over sleeps,
// unique seeded users per run.
test.describe('household lifecycle', () => {
  test.afterAll(async () => {
    await closeDb()
  })

  async function signOut(page: Page): Promise<void> {
    await page.getByTestId('user-menu-trigger').click()
    await page.getByTestId('signout-button').click()
    await page.getByTestId('signout-confirm').click()
    await page.waitForURL(/\/$/)
  }

  test('owner creates a household, invites, a member joins, then is removed', async ({ page }) => {
    const ownerEmail = uniqueEmail()
    const memberEmail = uniqueEmail()

    // --- Owner: register, onboard, promote to PREMIUM, re-login to refresh role.
    await register(page, ownerEmail)
    await completeOnboarding(page)
    await setRole(ownerEmail, 'PREMIUM')
    await signOut(page)
    await login(page, ownerEmail)
    await page.waitForURL(/\/dashboard$/)

    // --- Owner: create the household.
    await page.goto('/household')
    await page.getByTestId('household-create').click()
    await page.getByTestId('household-name-input').fill('E2E Home')
    await page.getByTestId('household-create-submit').click()

    // Roster appears with the owner and an empty weekly pool.
    await expect(page.getByTestId('household-roster')).toBeVisible()
    await expect(page.getByTestId('household-pool')).toContainText('0 / 15')

    // --- Owner: mint an invite and capture its token.
    await page.getByTestId('household-invite-generate').click()
    await expect(page.getByTestId('household-invite-url')).toBeVisible()
    const token = (await page.getByTestId('household-invite-token').textContent())?.trim()
    expect(token).toBeTruthy()

    await signOut(page)

    // --- Member: register, onboard, then accept the invite via the join page.
    await register(page, memberEmail)
    await completeOnboarding(page)
    await page.goto(`/household/join?token=${encodeURIComponent(token!)}`)
    await expect(page.getByTestId('household-join')).toContainText('You’re in')
    await page.getByTestId('household-join-continue').click()

    // The member now sees the two-person roster (read-only: no remove buttons).
    await expect
      .poll(async () => page.locator('[data-testid^="household-member-"]').count(), { timeout: 5000 })
      .toBe(2)
    await expect(page.locator('[data-testid^="household-remove-"]')).toHaveCount(0)

    await signOut(page)

    // --- Owner: log back in and remove the member.
    await login(page, ownerEmail)
    await page.waitForURL(/\/dashboard$/)
    await page.goto('/household')
    await expect
      .poll(async () => page.locator('[data-testid^="household-member-"]').count(), { timeout: 5000 })
      .toBe(2)

    await page.locator('[data-testid^="household-remove-"]').first().click()
    await page.getByTestId('confirm-delete').click()

    await expect
      .poll(async () => page.locator('[data-testid^="household-member-"]').count(), { timeout: 5000 })
      .toBe(1)

    await deleteUser(memberEmail)
    await deleteUser(ownerEmail)
  })
})
