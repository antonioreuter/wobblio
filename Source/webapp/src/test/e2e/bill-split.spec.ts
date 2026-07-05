import { test, expect, type Page } from '@playwright/test'
import { register, login, completeOnboarding, uniqueEmail } from './helpers/flows'
import { deleteUser, setRole, seedParsedInvoice, closeDb } from './helpers/db'

// Bill-split happy path against the local stack: a Premium tenant with a PARSED
// invoice (seeded directly — no need to exercise real Bedrock parsing for this
// feature) creates a split, adds a participant, assigns a line, and the summary
// reconciles. Per the e2e rules: data-testid selectors, polling over sleeps,
// unique seeded tenant per run.
test.describe('bill splitting', () => {
  test.afterAll(async () => {
    await closeDb()
  })

  async function signOut(page: Page): Promise<void> {
    await page.getByTestId('user-menu-trigger').click()
    await page.getByTestId('signout-button').click()
    await page.getByTestId('signout-confirm').click()
    await page.waitForURL(/\/$/)
  }

  test('assigns a line to a participant and the summary reconciles', async ({ page, context }) => {
    const email = uniqueEmail()

    await register(page, email)
    await completeOnboarding(page)
    await setRole(email, 'PREMIUM')
    await signOut(page)

    const { invoiceId } = await seedParsedInvoice(email, [
      { rawText: 'Bread', lineTotal: 3.5 },
      { rawText: 'Milk', lineTotal: 2 },
    ])

    // Re-login so the session picks up the PREMIUM role set above.
    await login(page, email)
    await page.waitForURL(/\/dashboard$/)

    await page.goto('/invoices')
    await expect(page.getByTestId(`invoice-row-${invoiceId}`)).toBeVisible()
    await page.getByTestId(`invoice-row-${invoiceId}`).click()

    await page.getByTestId('split-open').click()
    await expect(page.getByTestId('split-dialog')).toBeVisible()
    await expect(page.getByTestId('split-summary')).toBeVisible()

    // Add participants to the roster — no active-target step is needed anymore,
    // single-quantity items are assigned by tapping people directly on the line.
    await page.getByTestId('split-participant-input').fill('Alex')
    await page.getByTestId('split-add-participant').click()
    await page.getByTestId('split-participant-input').fill('Bob')
    await page.getByTestId('split-add-participant').click()

    // Each single-quantity line carries an inline sharer toggle per person. The
    // "Bread" line's toggles live inside its .split-line container; locate by the
    // visible person name on the pill.
    const breadCard = page.locator('.split-line', { hasText: 'Bread' })
    const sharer = (name: string) =>
      breadCard.locator('[data-testid^="split-sharer-"]', { hasText: name })

    // Tap Alex → Alex takes the whole item (denominator 1); "You" covers the rest.
    await sharer('Alex').click()
    // Tapping a sharer also highlights the line so it's obvious which item is being edited.
    await expect(breadCard).toHaveClass(/is-selected/)
    await expect(page.getByTestId('split-summary')).toContainText('Alex')
    await expect(page.getByTestId('split-summary')).toContainText('€3.50')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    // Tap Bob → the SAME single-quantity item now splits ½ Alex + ½ Bob (€1.75 each).
    // This is the flow that was previously impossible on mobile and unintuitive on web.
    await sharer('Bob').click()
    await expect(page.getByTestId('split-summary')).toContainText('€1.75')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    // Tap "You" in → three-way even split (⅓ each ≈ €1.17).
    await sharer('You').click()
    await expect(page.getByTestId('split-summary')).toContainText('€1.17')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    // Toggle Bob back out → Bread re-splits evenly between the rest (Alex + You, €1.75).
    await sharer('Bob').click()
    await expect(page.getByTestId('split-summary')).toContainText('€1.75')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    // Toggle "You" out → the whole item falls back to Alex.
    await sharer('You').click()
    await expect(page.getByTestId('split-summary')).toContainText('Alex')
    await expect(page.getByTestId('split-summary')).toContainText('€3.50')

    // Share the split: one action mints a public read-only link, shown in the standard
    // share panel (the same ShareLink component as invoice sharing) with a Copy button.
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByTestId('split-share-create').click()
    await expect(page.getByTestId('split-share-link')).toBeVisible()
    await expect
      .poll(async () => page.getByTestId('split-share-link').locator('input').inputValue())
      .toContain('/s/')
    await page.getByTestId('split-share-copy').click()
    await expect
      .poll(async () => page.evaluate(() => navigator.clipboard.readText()), { timeout: 5000 })
      .toContain('/s/')

    // Removing the participant chip unassigns their lines and the chip disappears
    // (also exercises the remove control's DOM structure — a sibling button next
    // to the select button, not nested inside it).
    await page.getByTestId('split-chip-remove-Alex').click()
    await expect(page.getByTestId('split-chip-Alex')).toHaveCount(0)
    await expect(page.getByTestId('split-summary')).not.toContainText('Alex')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    await deleteUser(email)
  })
})
