import { describe, it, expect } from 'vitest'
import { STATUS_MAP, STATUS_LEGEND } from './invoice-map'

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
