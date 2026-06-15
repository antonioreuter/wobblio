import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { OnboardingForm } from './onboarding-form'

const signOut = vi.fn()
const assign = vi.fn()
let sessionData: { user?: { name?: string } } | null = { user: { name: '' } }

vi.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => signOut(...args),
  useSession: () => ({ data: sessionData, update: vi.fn() }),
}))

function mockOnboarding(opts: { ok?: boolean; status?: number; body?: unknown }) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/onboarding') {
      return { ok: opts.ok ?? true, status: opts.status ?? 200, json: async () => opts.body ?? {} } as Response
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function fillValidForm() {
  fireEvent.change(screen.getByTestId('onboarding-fullName'), { target: { value: 'Ada Lovelace' } })
  fireEvent.change(screen.getByTestId('onboarding-birthdate'), { target: { value: '1990-12-10' } })
  fireEvent.click(screen.getByTestId('onboarding-consent'))
}

describe('OnboardingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionData = { user: { name: '' } }
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign, href: 'https://test.local/onboarding', origin: 'https://test.local' },
    })
    cleanup()
  })

  it('submits then hard-navigates to /dashboard (server gate re-derives onboarding from the DB)', async () => {
    mockOnboarding({ ok: true, status: 200 })

    render(<OnboardingForm />)
    fillValidForm()
    fireEvent.click(screen.getByTestId('onboarding-submit'))

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows the session-expired state on a 401 and does not navigate', async () => {
    mockOnboarding({ ok: false, status: 401 })

    render(<OnboardingForm />)
    fillValidForm()
    fireEvent.click(screen.getByTestId('onboarding-submit'))

    expect(await screen.findByTestId('onboarding-session-expired')).toBeInTheDocument()
    expect(assign).not.toHaveBeenCalled()
  })

  it('short-circuits client-side without a POST when required fields are missing', () => {
    const fetchMock = mockOnboarding({ ok: true, status: 200 })

    render(<OnboardingForm />)
    fireEvent.click(screen.getByTestId('onboarding-submit'))

    expect(screen.getByTestId('onboarding-error')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('pre-fills the full name from the session', () => {
    sessionData = { user: { name: 'Grace Hopper' } }
    render(<OnboardingForm />)
    expect(screen.getByTestId('onboarding-fullName')).toHaveValue('Grace Hopper')
  })
})
