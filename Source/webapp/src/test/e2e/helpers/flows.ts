import { expect, type Page } from '@playwright/test'

// Meets the register form's rule: >=12 chars, upper, lower, number, symbol.
export const STRONG_PASSWORD = 'E2eWobblio!2345'

// Unique per test so runs don't collide (the local stack persists data).
export function uniqueEmail(): string {
  return `e2e+${Date.now()}-${Math.floor(Math.random() * 1e6)}@wobblio.local`
}

// Register a brand-new user via the real register form. Locally this triggers
// SignUp + AdminConfirmSignUp + provisionUser (see (auth)/actions.ts), so the user
// lands on /onboarding as a confirmed, not-yet-onboarded account.
export async function register(page: Page, email: string, password = STRONG_PASSWORD): Promise<void> {
  await page.goto('/register')
  await page.getByTestId('register-email').fill(email)
  await page.getByTestId('register-password').fill(password)
  await page.getByTestId('register-confirm').fill(password)
  await page.getByTestId('register-submit').click()
  await page.waitForURL('**/onboarding')
}

// Sign in through the local credentials form.
export async function login(page: Page, email: string, password = STRONG_PASSWORD): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
}

// Complete the onboarding form and assert it lands on the dashboard.
export async function completeOnboarding(page: Page): Promise<void> {
  await page.getByTestId('onboarding-fullName').fill('E2E Tester')
  await page.getByTestId('onboarding-birthdate').fill('1990-05-20')
  // The consent checkbox's native input is display:none; the clickable element is
  // its wrapping <label> (the consent copy), so toggle via the label text.
  await page.getByText(/I agree to Wobblio processing my data/i).click()
  await page.getByTestId('onboarding-submit').click()
  await page.waitForURL('**/dashboard')
}
