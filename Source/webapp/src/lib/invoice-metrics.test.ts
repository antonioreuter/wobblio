import { describe, it, expect } from 'vitest'
import { computeDailySeriesForMonth, computeSpendMetrics } from './invoice-metrics'
import { type Invoice } from '@/components/workspace/invoice-data'

describe('invoice-metrics Unit Tests', () => {
  const createMockInvoice = (dateISO: string, total: number): Invoice => ({
    id: 'mock-id',
    merchant: 'Test Merchant',
    category: 'Groceries',
    categoryId: 'cat-groceries',
    dateISO,
    status: ['success', 'Ready'],
    isProcessing: false,
    rawStatus: 'PARSED',
    tags: [],
    searchCity: null,
    total,
    locationStatus: 'RESOLVED',
    locationCountryCode: null,
    locationRegionCode: null,
    locationConfirmable: true,
  })

  describe('computeDailySeriesForMonth', () => {
    it('correctly aggregates invoices by day, identifies weekends, and creates readable labels', () => {
      // 2026-06-13 is a Saturday (weekend)
      // 2026-06-14 is a Sunday (weekend)
      // 2026-06-15 is a Monday (weekday)
      const mockInvoices: Invoice[] = [
        createMockInvoice('2026-06-13', 25.50),
        createMockInvoice('2026-06-13', 10.00), // Multiple invoices on same day
        createMockInvoice('2026-06-14', 15.00),
        createMockInvoice('2026-06-15', 5.00),
        createMockInvoice('2026-05-15', 100.00), // Other month, should be ignored
      ]

      const now = new Date('2026-06-15')
      const result = computeDailySeriesForMonth(mockInvoices, now)

      // Result should have 15 elements (days 1 to 15)
      expect(result.length).toBe(15)

      // Verify June 13 (Day 13) - Saturday
      expect(result[12]).toEqual({
        day: '13',
        total: 35.50,
        isWeekend: true,
        weekday: 'Sat',
        dateLabel: 'Sat, Jun 13',
      })

      // Verify June 14 (Day 14) - Sunday
      expect(result[13]).toEqual({
        day: '14',
        total: 15.00,
        isWeekend: true,
        weekday: 'Sun',
        dateLabel: 'Sun, Jun 14',
      })

      // Verify June 15 (Day 15) - Monday
      expect(result[14]).toEqual({
        day: '15',
        total: 5.00,
        isWeekend: false,
        weekday: 'Mon',
        dateLabel: 'Mon, Jun 15',
      })

      // Verify June 1 (Day 1) - Monday (June 1st, 2026 was a Monday)
      expect(result[0]).toEqual({
        day: '1',
        total: 0.00,
        isWeekend: false,
        weekday: 'Mon',
        dateLabel: 'Mon, Jun 1',
      })
    })
  })

  describe('computeSpendMetrics', () => {
    it('computes monthly spending metrics and series correctly', () => {
      const now = new Date('2026-06-15')
      const mockInvoices: Invoice[] = [
        createMockInvoice('2026-06-10', 50.00), // This month
        createMockInvoice('2026-05-10', 40.00), // Last month
      ]

      const result = computeSpendMetrics(mockInvoices, now)
      expect(result.thisMonth).toBe(50.00)
      expect(result.lastMonth).toBe(40.00)
      expect(result.deltaPct).toBeCloseTo(25) // 25% increase
      expect(result.series.length).toBe(6)
    })
  })
})
