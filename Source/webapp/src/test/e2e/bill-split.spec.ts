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

    // Tapping the "Bread" line assigns it to the active participant (Alex) at
    // fraction 1 — no separate picker step in the tap-to-cycle interaction model.
    const breadLine = page.locator('[data-testid^="split-assign-"]', { hasText: 'Bread' })
    await breadLine.click()

    // Summary reconciles: Alex owes for Bread, "You" covers the rest, and the
    // total always equals the invoice total (computeSplitSummary's invariant).
    await expect(page.getByTestId('split-summary')).toContainText('Alex')
    await expect(page.getByTestId('split-summary')).toContainText('€3.50')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    // Tapping the same line again (Alex still active) cycles the fraction to ½ —
    // Alex's share halves and "You" absorbs the rest, total still reconciles.
    await breadLine.click()
    await expect(page.getByTestId('split-summary')).toContainText('€1.75')
    await expect(page.getByTestId('split-summary')).toContainText('€3.75')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    // Third tap cycles to ⅓ — this is the step that used to get stuck: the backend
    // rounds 1/3 to NUMERIC(5,4) (0.3333) on the round-trip, so the epsilon used to
    // match it against the client's raw 1/3 must be loose enough to still equal it.
    await breadLine.click()
    await expect(page.getByTestId('split-summary')).toContainText('€1.17')
    await expect(page.getByTestId('split-summary')).toContainText('€4.33')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    // Fourth tap wraps the cycle to "unassign" — this is the other half of the same
    // bug: with a too-tight epsilon, the ⅓ round-trip value never matched anything
    // in FRACTION_CYCLE, so the cycle silently restarted at fraction 1 instead.
    await breadLine.click()
    await expect(page.getByTestId('split-summary')).not.toContainText('Alex')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    // Re-assign (fresh cycle, fraction 1) for the "You"-active unassign path below.
    await breadLine.click()
    await expect(page.getByTestId('split-summary')).toContainText('€3.50')

    // Switching the active participant back to "You" and tapping the line again
    // unassigns it — "You" is never itself an assignable/cyclable participant.
    await page.getByTestId('split-chip-You').click()
    await breadLine.click()
    await expect(page.getByTestId('split-summary')).not.toContainText('Alex')
    await expect(page.getByTestId('split-summary')).toContainText('€5.50')

    // Re-assign Bread to Alex (full) so the WhatsApp export below has someone to name.
    await page.getByTestId('split-chip-Alex').click()
    await breadLine.click()
    await expect(page.getByTestId('split-summary')).toContainText('Alex')

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
