'use client'

import { useEffect, useState } from 'react'
import { MapPin, Pencil } from 'lucide-react'
import { Button } from '@/components/ds/Button'
import { COUNTRIES } from '@/lib/locale-options'

interface Region {
  code: string
  name: string
}

interface RegionPickerProps {
  countryCode: string
  regionCode: string
  onChange: (countryCode: string, regionCode: string) => void
  // Optional controlled open state, so a caller can open the editor from elsewhere (the reports
  // "Choose a region" prompt). Omit both to keep the self-contained behaviour.
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// §6.5 serves the caller's own region by default; the region stays collapsed behind a
// label + "Modify" until the user expands it to compare another region. Country/region
// options come from the same ISO 3166 reference lists as onboarding.
export function RegionPicker({
  countryCode,
  regionCode,
  onChange,
  open: openProp,
  onOpenChange,
}: RegionPickerProps) {
  const [selfOpen, setSelfOpen] = useState(false)
  const open = openProp ?? selfOpen
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setSelfOpen(next))
  const [draftCountry, setDraftCountry] = useState(countryCode)
  const [draftRegion, setDraftRegion] = useState(regionCode)
  const [regions, setRegions] = useState<Region[]>([])

  // Start every edit from the applied values, whoever opened the editor.
  useEffect(() => {
    if (!open) return
    setDraftCountry(countryCode)
    setDraftRegion(regionCode)
  }, [open, countryCode, regionCode])

  useEffect(() => {
    let active = true
    fetch(`/api/reference/regions?country=${draftCountry}`)
      .then((res) => (res.ok ? res.json() : { subdivisions: [] }))
      .then((data: { subdivisions?: Region[] }) => {
        if (!active) return
        const subs = data.subdivisions ?? []
        setRegions(subs)
        setDraftRegion((cur) => (cur && !subs.some((s) => s.code === cur) ? '' : cur))
      })
      .catch(() => { if (active) setRegions([]) })
    return () => { active = false }
  }, [draftCountry])

  const countryName = COUNTRIES.find((c) => c.code === countryCode)?.name ?? countryCode
  const regionName = regions.find((r) => r.code === regionCode)?.name
  const label = regionName ? `${regionName}, ${countryName}` : (regionCode || countryName)

  const apply = () => {
    onChange(draftCountry, draftRegion)
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="region-label" data-testid="trend-region-label">
        <MapPin size={14} />
        <span>{label}</span>
        <button type="button" className="btn btn--text region-modify" onClick={() => setOpen(true)} data-testid="trend-region-modify">
          <Pencil size={12} /> Modify
        </button>
      </div>
    )
  }

  return (
    <div className="region-editor" data-testid="trend-region-editor">
      <div className="filter-field">
        <label className="filter-label">Country</label>
        <select
          className="filter-select"
          value={draftCountry}
          onChange={(e) => { setDraftCountry(e.target.value); setDraftRegion('') }}
          data-testid="trend-region-country"
        >
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </div>
      <div className="filter-field">
        <label className="filter-label">Region</label>
        <select
          className="filter-select"
          value={draftRegion}
          onChange={(e) => setDraftRegion(e.target.value)}
          data-testid="trend-region-region"
        >
          <option value="">Select a region…</option>
          {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
        </select>
      </div>
      <div className="region-editor-actions">
        <button type="button" className="btn btn--text" onClick={() => setOpen(false)}>Cancel</button>
        <Button variant="primary" onClick={apply} disabled={!draftRegion} style={{ padding: '8px 16px', fontSize: 13 }}>
          Apply
        </Button>
      </div>
    </div>
  )
}
