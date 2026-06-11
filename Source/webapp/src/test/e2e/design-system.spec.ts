import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Design System', () => {
  test('renders without crashing', async ({ page }) => {
    await page.goto('/design-system')
    await expect(page.getByText('Wobblio Design System')).toBeVisible()
  })

  test('has no critical a11y violations', async ({ page }) => {
    await page.goto('/design-system')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0)
  })

  test('all budget progress bars have aria attributes', async ({ page }) => {
    await page.goto('/design-system')
    const bars = page.getByRole('progressbar')
    const count = await bars.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(bars.nth(i)).toHaveAttribute('aria-valuenow')
      await expect(bars.nth(i)).toHaveAttribute('aria-valuemin')
      await expect(bars.nth(i)).toHaveAttribute('aria-valuemax')
    }
  })
})
