import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { InvoiceLocationGate } from './invoice-location-gate'
import type { Invoice } from './invoice-data'

const invoice = (overrides: Partial<Invoice>): Invoice => ({
  id: 'inv-1',
  merchant: 'Albert Heijn',
  category: 'Groceries',
  dateISO: '2026-06-10',
  status: ['success', 'Ready'],
  tags: [],
  total: 12.5,
  locationStatus: 'RESOLVED',
  locationCountryCode: 'NL',
  locationRegionCode: null,
  locationConfirmable: true,
  ...overrides,
})

describe('InvoiceLocationGate', () => {
  beforeEach(() => {
    // Region lookup follows the selected country; an empty list keeps the gate to its
    // country dropdown, which is all these tests assert on.
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ subdivisions: [] }) }) as never
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders the editable country control for a PENDING, confirmable invoice', async () => {
    render(<InvoiceLocationGate invoice={invoice({ locationStatus: 'PENDING' })} onConfirmed={vi.fn()} />)

    expect(await screen.findByTestId('invoice-location-gate')).toBeInTheDocument()
    expect(screen.getByTestId('invoice-location-country')).toBeInTheDocument()
  })

  it('renders no gate for a RESOLVED invoice (the location is locked)', () => {
    const { container } = render(<InvoiceLocationGate invoice={invoice({ locationStatus: 'RESOLVED' })} onConfirmed={vi.fn()} />)

    expect(screen.queryByTestId('invoice-location-gate')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders no gate for a PENDING invoice that is not yet confirmable', () => {
    render(<InvoiceLocationGate invoice={invoice({ locationStatus: 'PENDING', locationConfirmable: false })} onConfirmed={vi.fn()} />)

    expect(screen.queryByTestId('invoice-location-gate')).not.toBeInTheDocument()
  })

  it('prefills the country from the invoice without re-fetching the profile', async () => {
    render(<InvoiceLocationGate invoice={invoice({ locationStatus: 'PENDING', locationCountryCode: 'NL' })} onConfirmed={vi.fn()} />)

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const urls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('/api/me/profile'))).toBe(false)
  })
})
