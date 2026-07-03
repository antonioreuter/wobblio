import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import SettingsPage from './page'

let sessionValue: unknown = { user: { role: 'STANDARD', email: 'ada@wobblio.nl', name: 'Ada Lovelace' } }
const showToast = vi.fn()

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: sessionValue }) }))

vi.mock('@/components/workspace', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/workspace')>()
  return {
    ...actual,
    useWorkspace: () => ({ usage: { used: 3, cap: 10, remaining: 7, unlimited: false }, showToast }),
  }
})

const baseProfile = {
  fullName: 'Ada Lovelace',
  country: 'NL',
  regionCode: 'NL-NB',
  language: 'nl',
  currency: 'EUR',
  birthdate: '1990-12-10',
  onboarded: true,
  role: 'STANDARD',
  status: 'ACTIVE',
  priceContributionOptout: false,
}

interface FetchRoutes {
  profile?: unknown
  household?: unknown
  latestExport?: unknown
  regions?: { code: string; name: string }[]
}

function stubFetch({ profile = baseProfile, household = null, latestExport = null, regions = [] }: FetchRoutes) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith('/api/me/profile')) return { ok: true, json: async () => profile }
    if (url.startsWith('/api/households/mine')) return { ok: true, json: async () => ({ household }) }
    if (url.startsWith('/api/me/export/latest')) return { ok: true, json: async () => ({ request: latestExport }) }
    if (url.startsWith('/api/reference/regions')) return { ok: true, json: async () => ({ subdivisions: regions }) }
    if (url.startsWith('/api/me/price-contribution-optout')) return { ok: true }
    if (url.startsWith('/api/me/export') && init?.method === 'POST') {
      return { ok: true, status: 202, json: async () => ({ requestId: 'req-9' }) }
    }
    throw new Error(`unhandled fetch: ${url}`)
  }))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  showToast.mockClear()
  sessionValue = { user: { role: 'STANDARD', email: 'ada@wobblio.nl', name: 'Ada Lovelace' } }
})

describe('SettingsPage', () => {
  it('loads the profile, plan badge, and household summary', async () => {
    stubFetch({})
    render(<SettingsPage />)

    expect(await screen.findByTestId('settings-fullname')).toHaveValue('Ada Lovelace')
    expect(screen.getByText('STANDARD')).toBeInTheDocument()
    expect(screen.getByText('You’re not in a household yet.')).toBeInTheDocument()
  })

  it('shows the household name and member count when the user has one', async () => {
    stubFetch({
      household: { id: 'hh-1', name: 'The Jansens', ownerUserId: 'u-1', members: [{ userId: 'u-1' }, { userId: 'u-2' }] },
    })
    render(<SettingsPage />)

    expect(await screen.findByText('The Jansens · 2 member(s)')).toBeInTheDocument()
  })

  it('toggles the price-contribution opt-out and calls the backend', async () => {
    stubFetch({})
    render(<SettingsPage />)

    const toggle = await screen.findByTestId('settings-optout-toggle')
    expect(toggle).toBeChecked() // priceContributionOptout: false → still contributing

    fireEvent.click(toggle)

    await waitFor(() => {
      const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
      expect(fetchMock).toHaveBeenCalledWith('/api/me/price-contribution-optout', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ optout: true }),
      }))
    })
  })

  it('requests a data export and shows the pending state', async () => {
    stubFetch({})
    render(<SettingsPage />)

    const requestButton = await screen.findByTestId('settings-export-request')
    fireEvent.click(requestButton)

    expect(await screen.findByTestId('settings-export-status')).toHaveTextContent(/preparing your export/i)
  })

  it('shows a download action once the export has completed', async () => {
    stubFetch({
      latestExport: { id: 'req-1', status: 'COMPLETED', requestedAt: '2026-07-01T00:00:00Z', completedAt: '2026-07-01T00:05:00Z' },
    })
    render(<SettingsPage />)

    expect(await screen.findByTestId('settings-export-download')).toBeInTheDocument()
  })

  it('renders the delete-account card as visibly disabled', async () => {
    stubFetch({})
    render(<SettingsPage />)

    expect(await screen.findByTestId('settings-delete-disabled')).toBeDisabled()
  })

  it('resets the selected region when the country changes', async () => {
    stubFetch({ regions: [{ code: 'NL-NB', name: 'Noord-Brabant' }, { code: 'DE-BE', name: 'Berlin' }] })
    render(<SettingsPage />)

    const regionSelect = await screen.findByTestId('settings-region')
    expect(regionSelect).toHaveValue('NL-NB')

    const countrySelect = screen.getByTestId('settings-country')
    fireEvent.change(countrySelect, { target: { value: 'DE' } })

    await waitFor(() => expect(screen.getByTestId('settings-region')).toHaveValue(''))
  })

  it('requires a region before saving when the selected country has subdivisions', async () => {
    stubFetch({ regions: [{ code: 'NL-NB', name: 'Noord-Brabant' }, { code: 'DE-BE', name: 'Berlin' }] })
    render(<SettingsPage />)

    const countrySelect = await screen.findByTestId('settings-country')
    fireEvent.change(countrySelect, { target: { value: 'DE' } }) // resets regionCode to ''
    await waitFor(() => expect(screen.getByTestId('settings-region')).toHaveValue(''))

    fireEvent.click(screen.getByTestId('settings-save-profile'))

    expect(showToast).toHaveBeenCalledWith('Please select your region.', 'danger')
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
    expect(fetchMock).not.toHaveBeenCalledWith('/api/me/profile', expect.objectContaining({ method: 'PUT' }))
  })

  it('only shows "Manage billing" for PREMIUM accounts', async () => {
    sessionValue = { user: { role: 'PREMIUM', email: 'ada@wobblio.nl', name: 'Ada Lovelace' } }
    stubFetch({ profile: { ...baseProfile, role: 'PREMIUM' } })
    render(<SettingsPage />)

    expect(await screen.findByTestId('settings-manage-billing')).toBeInTheDocument()
  })
})
