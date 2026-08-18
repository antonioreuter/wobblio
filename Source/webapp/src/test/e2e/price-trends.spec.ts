import { test, expect, type Page } from '@playwright/test'
import { register, login, completeOnboarding, uniqueEmail } from './helpers/flows'
import { closeDb, deleteProduct, deleteUser, seedOwnPurchase, setRegion } from './helpers/db'

// The price-trends report against the local stack. The scenario is deliberately the smallest one
// that used to fail: ONE product with ONE purchase in ONE week. That rendered as a 2.5px dot with
// no line and no label — indistinguishable from "the chart isn't drawing".
// Per .claude/rules/e2e-testing-coordinator.md: data-testid selectors, unique seeded tenant per
// run, web-first assertions (auto-polling) instead of sleeps.
test.describe('price trends', () => {
  const COUNTRY = 'NL'
  const REGION = 'NL-NB'
  const PRODUCT = `E2E Trend Melk ${Date.now()}`

  let email = ''
  let productId = ''

  test.afterAll(async () => {
    if (email) await deleteUser(email)
    if (productId) await deleteProduct(productId)
    await closeDb()
  })

  // /login redirects an authenticated session to the dashboard, so the re-login below only works
  // from a signed-out state.
  async function signOut(page: Page): Promise<void> {
    await page.getByTestId('user-menu-trigger').click()
    await page.getByTestId('signout-button').click()
    await page.getByTestId('signout-confirm').click()
    await page.waitForURL(/\/$/)
  }

  test('charts a single purchase visibly, and the table twin agrees', async ({ page }) => {
    email = uniqueEmail()
    await register(page, email)
    await completeOnboarding(page)
    await signOut(page)

    // Pin the region the report defaults to, then seed one own purchase in it.
    await setRegion(email, COUNTRY, REGION)
    const seeded = await seedOwnPurchase(email, {
      displayName: PRODUCT,
      price: 1.29,
      countryCode: COUNTRY,
      regionCode: REGION,
    })
    productId = seeded.productId

    // Re-login so the session picks up the profile written above.
    await login(page, email)
    await page.waitForURL(/\/dashboard$/)
    await page.goto('/reports')

    await expect(page.getByTestId('trend-region-label')).toContainText(/Brabant|NL/)

    await page.getByTestId('trend-product-search').fill(PRODUCT.slice(0, 14))
    await page.getByText(PRODUCT, { exact: true }).click()

    // The regression: a lone observation must be a real marker carrying its value, and the chart
    // must not fall through to an empty state.
    await expect(page.locator('.chart-point')).toHaveCount(1)
    await expect(page.locator('.chart-point-label')).toContainText('1,29')
    await expect(page.getByTestId('trends-empty')).toHaveCount(0)
    await expect(page.getByTestId('trends-region-required')).toHaveCount(0)

    // The mandatory data-table twin shows the same single week (§10.3 accessibility floor).
    await page.getByTestId('trends-view-table').click()
    const table = page.getByTestId('trends-table')
    await expect(table).toBeVisible()
    await expect(table.locator('tbody tr')).toHaveCount(1)
    await expect(table).toContainText('1,29')
  })
})
