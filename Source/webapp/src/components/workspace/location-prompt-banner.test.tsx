import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LocationPromptBanner } from './location-prompt-banner'
import { needsLocationConfirmation, type Invoice } from './invoice-data'

const invoice = (overrides: Partial<Invoice>): Invoice => ({
  id: 'inv-1',
  merchant: 'Albert Heijn',
  category: 'Groceries',
  categoryId: null,
  dateISO: '2026-06-10',
  status: ['success', 'Ready'],
  isProcessing: false,
  rawStatus: 'PARSED',
  tags: [],
  searchCity: null,
  total: 12.5,
  currency: 'EUR',
  locationStatus: 'RESOLVED',
  locationCountryCode: 'NL',
  locationRegionCode: null,
  locationConfirmable: true,
  ...overrides,
})

describe('needsLocationConfirmation', () => {
  it('flags only a PENDING, confirmable invoice', () => {
    expect(needsLocationConfirmation(invoice({ locationStatus: 'PENDING' }))).toBe(true)
  })

  it('ignores RESOLVED and HELD_UNMAPPED — nothing for the user to do', () => {
    expect(needsLocationConfirmation(invoice({ locationStatus: 'RESOLVED' }))).toBe(false)
    expect(needsLocationConfirmation(invoice({ locationStatus: 'HELD_UNMAPPED' }))).toBe(false)
  })

  it('ignores a PENDING invoice that is not yet confirmable (duplicate/in-flight)', () => {
    expect(needsLocationConfirmation(invoice({ locationStatus: 'PENDING', locationConfirmable: false }))).toBe(false)
  })
})

describe('LocationPromptBanner', () => {
  it('renders nothing when there is nothing pending', () => {
    const { container } = render(<LocationPromptBanner count={0} onConfirm={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('pluralises and routes the confirm action', () => {
    const onConfirm = vi.fn()
    render(<LocationPromptBanner count={3} onConfirm={onConfirm} />)

    expect(screen.getByTestId('location-prompt-banner')).toHaveTextContent('3 receipts need')
    fireEvent.click(screen.getByTestId('location-prompt-confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('uses the singular form for a single pending receipt', () => {
    render(<LocationPromptBanner count={1} onConfirm={vi.fn()} />)
    expect(screen.getByTestId('location-prompt-banner')).toHaveTextContent('1 receipt needs')
  })
})
