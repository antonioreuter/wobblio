import { describe, it, expect } from 'vitest'
import { formatMoney, formatDelta, formatCompact } from './currency'

describe('formatMoney', () => {
  it('formats EUR amounts in nl-NL locale', () => {
    const result = formatMoney(1284.5)
    expect(result).toContain('1.284,50')
  })

  it('formats zero', () => {
    expect(formatMoney(0)).toContain('0,00')
  })

  it('shows negative sign for negative amounts by default', () => {
    expect(formatMoney(-50)).toContain('-')
    expect(formatMoney(50)).not.toContain('+')
  })

  it('shows explicit + sign for positive amounts when showSign is true', () => {
    expect(formatMoney(50, { showSign: true })).toContain('+')
    expect(formatMoney(-50, { showSign: true })).toContain('-')
  })
})

describe('formatDelta', () => {
  it('formats positive delta with up arrow', () => {
    expect(formatDelta(8.3)).toBe('▲ 8.3%')
  })

  it('formats negative delta with down arrow', () => {
    expect(formatDelta(-5.2)).toBe('▼ 5.2%')
  })
})

describe('formatCompact', () => {
  it('compacts large numbers', () => {
    const result = formatCompact(1284500)
    expect(result).toContain('1,3')
  })
})
