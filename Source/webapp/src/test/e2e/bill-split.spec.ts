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

    // Add a participant — auto-activates them as the tap target. The "on" active
    // state lives on the wrapping chip <div> (the select/remove controls are
    // sibling <button>s inside it, not nested), so locate via that wrapper.
    await page.getByTestId('split-participant-input').fill('Alex')
    await page.getByTestId('split-add-participant').click()
    const alexChip = page.locator('div.split-chip', { has: page.getByTestId('split-chip-Alex') })
    await expect(alexChip).toHaveClass(/on/)

    // Tapping the "Bread" line shares it with the active participant (Alex). The
    // first tap gives Alex the whole item; "You" covers the rest.
    const breadLine = page.locator('[data-testid^="split-assign-"]', { hasText: 'Bread' })
    await breadLine.click()

    // The tapped line shows a distinct selected/edited highlight so it's obvious
    // which item is being associated to which people.
    const breadCard = page.locator('.split-line', { has: breadLine })
    await expect(breadCard).toHaveClass(/is-selected/)

    // Summary reconciles: Alex owes for Bread, "You" covers the rest, and the
    // total always equals the invoice total (computeSplitSummary's invariant).
    await expect(page.getByTestId('split-summary')).toContainText('Alex')
    await expect(page.getByTestId('split-summary')).toContainText('€3.50')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    // Share the SAME single-quantity item across a second person: add Bob (which
    // auto-activates him) and tap Bread — it now splits ½ Alex + ½ Bob (€1.75 each).
    await page.getByTestId('split-participant-input').fill('Bob')
    await page.getByTestId('split-add-participant').click()
    await breadLine.click()
    await expect(page.getByTestId('split-summary')).toContainText('€1.75')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    // Pull "You" into the share too → three-way even split (⅓ each ≈ €1.17).
    await page.getByTestId('split-chip-You').click()
    await breadLine.click()
    await expect(page.getByTestId('split-summary')).toContainText('€1.17')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    // Toggle Bob back out (Bob active) — Bread re-splits evenly between the rest.
    await page.getByTestId('split-chip-Bob').click()
    await breadLine.click()
    await expect(page.getByTestId('split-summary')).toContainText('€1.75')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    // Remove "You" from the share (You active) → the whole item falls back to Alex,
    // giving the WhatsApp export below a named owner.
    await page.getByTestId('split-chip-You').click()
    await breadLine.click()
    await expect(page.getByTestId('split-summary')).toContainText('Alex')
    await expect(page.getByTestId('split-summary')).toContainText('€3.50')

    // WhatsApp export copies to the clipboard.
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByTestId('split-copy-whatsapp').click()
    await expect
      .poll(async () => page.evaluate(() => navigator.clipboard.readText()), { timeout: 5000 })
      .toContain('Alex')

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
