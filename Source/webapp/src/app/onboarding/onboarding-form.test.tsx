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

const NL_SUBDIVISIONS = [
  { code: 'NL-NB', name: 'Noord-Brabant' },
  { code: 'NL-NH', name: 'Noord-Holland' },
]

// Handles both BFF calls the form makes: the region lookup on mount and the
// onboarding submit.
function mockApi(opts: { ok?: boolean; status?: number; body?: unknown; subdivisions?: { code: string; name: string }[] } = {}) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.startsWith('/api/reference/regions')) {
      return { ok: true, status: 200, json: async () => ({ subdivisions: opts.subdivisions ?? NL_SUBDIVISIONS }) } as Response
    }
    if (url === '/api/onboarding') {
      return { ok: opts.ok ?? true, status: opts.status ?? 200, json: async () => opts.body ?? {} } as Response
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

async function fillValidForm() {
  fireEvent.change(screen.getByTestId('onboarding-fullName'), { target: { value: 'Ada Lovelace' } })
  fireEvent.change(screen.getByTestId('onboarding-birthdate'), { target: { value: '1990-12-10' } })
  const region = await screen.findByTestId('onboarding-region')
  fireEvent.change(region, { target: { value: 'NL-NB' } })
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

  it('submits the selected region then hard-navigates to /dashboard', async () => {
    const fetchMock = mockApi({ ok: true, status: 200 })

    render(<OnboardingForm />)
    await fillValidForm()
    fireEvent.click(screen.getByTestId('onboarding-submit'))

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/dashboard'))
    const submitCall = fetchMock.mock.calls.find(([url]) => url === '/api/onboarding')!
    const body = JSON.parse((submitCall[1] as RequestInit).body as string)
    expect(body.regionCode).toBe('NL-NB')
    expect(body.country).toBe('NL')
  })

  it('loads region options for the default country and requires a selection', async () => {
    const fetchMock = mockApi({})

    render(<OnboardingForm />)
    fireEvent.change(screen.getByTestId('onboarding-fullName'), { target: { value: 'Ada Lovelace' } })
    fireEvent.change(screen.getByTestId('onboarding-birthdate'), { target: { value: '1990-12-10' } })
    await screen.findByTestId('onboarding-region') // options loaded
    fireEvent.click(screen.getByTestId('onboarding-consent'))
    fireEvent.click(screen.getByTestId('onboarding-submit'))

    expect(screen.getByTestId('onboarding-error')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/onboarding')).toBe(false)
  })

  it('shows the session-expired state on a 401 and does not navigate', async () => {
    mockApi({ ok: false, status: 401 })

    render(<OnboardingForm />)
    await fillValidForm()
    fireEvent.click(screen.getByTestId('onboarding-submit'))

    expect(await screen.findByTestId('onboarding-session-expired')).toBeInTheDocument()
    expect(assign).not.toHaveBeenCalled()
  })

  it('short-circuits client-side without a POST when required fields are missing', async () => {
    const fetchMock = mockApi({ ok: true, status: 200 })

    render(<OnboardingForm />)
    await screen.findByTestId('onboarding-region') // flush the mount region fetch
    fireEvent.click(screen.getByTestId('onboarding-submit'))

    expect(screen.getByTestId('onboarding-error')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/onboarding')).toBe(false)
  })

  it('pre-fills the full name from the session', async () => {
    sessionData = { user: { name: 'Grace Hopper' } }
    mockApi({})
    render(<OnboardingForm />)
    expect(screen.getByTestId('onboarding-fullName')).toHaveValue('Grace Hopper')
    await screen.findByTestId('onboarding-region') // flush the mount region fetch
  })
})
