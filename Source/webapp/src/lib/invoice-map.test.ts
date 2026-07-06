import { describe, it, expect } from 'vitest'
import { STATUS_MAP, STATUS_LEGEND, PROCESSING_STAGE_LABELS, mapInvoice, type BackendInvoice } from './invoice-map'

const backendInvoice = (overrides: Partial<BackendInvoice> = {}): BackendInvoice => ({
  id: 'inv-1',
  status: 'PROCESSING',
  merchantName: 'Jumbo',
  categoryId: null,
  transactionDate: null,
  total: 12.5,
  currency: 'EUR',
  searchTags: [],
  createdAt: '2026-07-06T10:00:00Z',
  locationStatus: 'RESOLVED',
  locationCountryCode: null,
  locationRegionCode: null,
  ...overrides,
})

describe('mapInvoice processing stage', () => {
  it('shows the stage-accurate label while PROCESSING', () => {
    for (const [stage, label] of Object.entries(PROCESSING_STAGE_LABELS)) {
      const inv = mapInvoice(backendInvoice({ processingStage: stage }))
      expect(inv.status).toEqual(['primary', label])
      expect(inv.isProcessing).toBe(true)
    }
  })

  it('falls back to the generic PROCESSING label without a stage (older backend)', () => {
    for (const stage of [undefined, null, 'SOMETHING_NEW']) {
      const inv = mapInvoice(backendInvoice({ processingStage: stage }))
      expect(inv.status).toEqual(STATUS_MAP.PROCESSING)
      expect(inv.isProcessing).toBe(true)
    }
  })

  it('ignores a stale stage once the status is terminal', () => {
    const inv = mapInvoice(backendInvoice({ status: 'PARSED', processingStage: 'READING' }))
    expect(inv.status).toEqual(STATUS_MAP.PARSED)
    expect(inv.isProcessing).toBe(false)
  })
})

describe('STATUS_LEGEND', () => {
  it('covers every status in STATUS_MAP (drift guard)', () => {
    const legendLabels = new Set(STATUS_LEGEND.map((s) => s.label))
    const mapLabels = Object.values(STATUS_MAP).map(([, label]) => label)
    for (const label of mapLabels) {
      expect(legendLabels.has(label)).toBe(true)
    }
    // One legend row per distinct user-visible label. NEEDS_REVIEW and PARSED
    // both render as "Ready", so they collapse into a single legend entry.
    const distinctLabels = new Set(Object.values(STATUS_MAP).map(([, label]) => label))
    expect(STATUS_LEGEND).toHaveLength(distinctLabels.size)
  })

  it('uses the same tone + label as the table badge for each status', () => {
    for (const entry of STATUS_LEGEND) {
      const match = Object.values(STATUS_MAP).find(([, label]) => label === entry.label)
      expect(match).toBeDefined()
      expect(entry.tone).toBe(match![0])
    }
  })

  it('gives every status a non-empty description', () => {
    for (const entry of STATUS_LEGEND) {
      expect(entry.description.trim().length).toBeGreaterThan(0)
    }
  })
})
