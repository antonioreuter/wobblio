import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import ReportsPage from './page'

const role = { current: 'PREMIUM' as 'PREMIUM' | 'STANDARD' }
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { role: role.current } }, status: 'authenticated' }),
}))

vi.mock('@/components/ds', () => ({
  Card: ({ children, className, ...rest }: { children: React.ReactNode; className?: string }) => (
    <div className={className} {...rest}>{children}</div>
  ),
}))

const PRODUCT = { productId: 'p-milk', displayName: 'Halfvolle melk', brand: 'AH', ownMerchantCount: 1, ownMerchantName: 'AH', marketMerchantCount: 0, marketMerchantName: null }

// A week that is inside every preset the page can pick, so these tests never depend on the clock.
const thisMonday = (): string => {
  const now = new Date()
  const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const back = (new Date(utc).getUTCDay() + 6) % 7
  return new Date(utc - back * 86_400_000).toISOString().slice(0, 10)
}

const ownLine = (over: Record<string, unknown> = {}) => ({
  productId: PRODUCT.productId,
  points: [{ weekStart: thisMonday(), median: 1.29, discountMedian: null }],
  purchaseCount: 1,
  priorPurchaseExists: false,
  lastPurchasedOn: thisMonday(),
  lastPrice: 1.29,
  previousPrice: null,
  size: { sizeText: null, sizeSource: null },
  stale: false,
  staleDays: 2,
  ...over,
})

interface Routes {
  profile?: unknown
  comparison?: unknown
}

const stubFetch = ({ profile, comparison }: Routes) => {
  const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.startsWith('/api/me/profile')) return json(profile ?? { country: 'NL', regionCode: 'NL-NB' })
      if (url.startsWith('/api/products/search')) return json({ products: [PRODUCT] })
      if (url.startsWith('/api/price-trends/comparison')) {
        return json(
          comparison ?? {
            countryCode: 'NL', regionCode: 'NL-NB', weeks: 26, currency: 'EUR',
            regionMerchantCount: 0, lines: [], ownHistory: [ownLine()], diagnostics: [],
          },
        )
      }
      if (url.startsWith('/api/price-trends/suggestions')) return json({ suggestions: [] })
      if (url.startsWith('/api/me/product-links')) return json({ links: [] })
      if (url.startsWith('/api/reference/regions')) return json({ subdivisions: [{ code: 'NL-NB', name: 'Noord-Brabant' }] })
      return json({})
    }),
  )
}

// Adds a product through the real typeahead, so the tests exercise the path a user takes.
const addProduct = async () => {
  fireEvent.change(screen.getByTestId('trend-product-search'), { target: { value: 'melk' } })
  const option = await screen.findByText('Halfvolle melk')
  fireEvent.mouseDown(option)
}

describe('ReportsPage', () => {
  beforeEach(() => {
    role.current = 'PREMIUM'
    vi.unstubAllGlobals()
  })

  it('asks for a region instead of blaming the user’s scanning when none is set', async () => {
    stubFetch({ profile: { country: 'NL', regionCode: null } })
    render(<ReportsPage />)
    await addProduct()

    const prompt = await screen.findByTestId('trends-region-required')
    expect(prompt).toHaveTextContent(/choose a region/i)
    // The misleading "no prices yet — once you've scanned…" copy must not appear here.
    expect(screen.queryByTestId('trends-empty')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /choose a region/i }))
    expect(await screen.findByTestId('trend-region-editor')).toBeInTheDocument()
  })

  it('charts a single-purchase product and labels its value', async () => {
    stubFetch({})
    const { container } = render(<ReportsPage />)
    await addProduct()

    await waitFor(() => expect(container.querySelector('.chart-point')).toBeInTheDocument())
    expect(container.querySelector('.chart-point-label')?.textContent).toContain('1,29')
    expect(screen.queryByTestId('trends-empty')).not.toBeInTheDocument()
  })

  it('swaps the chart for its data-table twin', async () => {
    stubFetch({})
    render(<ReportsPage />)
    await addProduct()
    await screen.findByText(/last paid/i)

    fireEvent.click(screen.getByTestId('trends-view-table'))
    expect(await screen.findByTestId('trends-table')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('trends-view-chart'))
    await waitFor(() => expect(screen.queryByTestId('trends-table')).not.toBeInTheDocument())
  })

  it('explains a product the chosen date range hides', async () => {
    stubFetch({
      comparison: {
        countryCode: 'NL', regionCode: 'NL-NB', weeks: 26, currency: 'EUR', regionMerchantCount: 0,
        lines: [],
        // Well outside the default 90-day preset but inside the 26-week window.
        ownHistory: [ownLine({ points: [{ weekStart: '2020-01-06', median: 1.29, discountMedian: null }] })],
        diagnostics: [{ productId: PRODUCT.productId, market: 'SERVED', own: 'SERVED' }],
      },
    })
    render(<ReportsPage />)
    await addProduct()

    expect(await screen.findByTestId('trend-chip-note')).toHaveTextContent('outside this date range')
  })

  it('locks the market view for STANDARD and shows the upsell', async () => {
    role.current = 'STANDARD'
    stubFetch({})
    render(<ReportsPage />)

    expect(screen.getByTestId('trends-upsell')).toBeInTheDocument()
    expect(screen.getByTestId('trends-mode-market')).toBeDisabled()
  })
})
