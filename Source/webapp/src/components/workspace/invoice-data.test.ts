import { describe, it, expect } from 'vitest'
import { fmtMoney } from './invoice-data'

describe('fmtMoney', () => {
  it('prefixes known currencies with their symbol', () => {
    expect(fmtMoney(12.5, 'EUR')).toBe('€12.50')
    expect(fmtMoney(12.5, 'GBP')).toBe('£12.50')
    expect(fmtMoney(12.5, 'USD')).toBe('$12.50')
  })

  it('falls back to a code prefix for unknown currencies', () => {
    expect(fmtMoney(9, 'SEK')).toBe('SEK 9.00')
  })

  it('omits any prefix when currency is unknown/null', () => {
    expect(fmtMoney(9, null)).toBe('9.00')
  })
})
