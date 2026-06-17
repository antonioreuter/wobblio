'use client'

import { useEffect, useState } from 'react'
import { MapPin, ShieldAlert, Clock } from 'lucide-react'
import { Button } from '@/components/ds/Button'
import { COUNTRIES, DEFAULT_COUNTRY } from '@/lib/locale-options'
import type { Invoice } from './invoice-data'

interface Region {
  code: string
  name: string
}

interface InvoiceLocationGateProps {
  invoice: Invoice
  onConfirmed: (status: 'RESOLVED' | 'HELD_UNMAPPED') => void
}

const banner: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 14,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
}

// Location quality gate (§6.5). A receipt whose location couldn't be resolved from
// the profile is held out of the regional price index until the user confirms where
// they shopped — once. Country/region are prefilled from the user's profile.
export function InvoiceLocationGate({ invoice, onConfirmed }: InvoiceLocationGateProps) {
  const [country, setCountry] = useState(invoice.locationCountryCode ?? DEFAULT_COUNTRY.code)
  const [regions, setRegions] = useState<Region[]>([])
  const [regionCode, setRegionCode] = useState(invoice.locationRegionCode ?? '')
  const [prefilled, setPrefilled] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prefill from the profile once: the user's home country/region is the sensible
  // default for "where did you shop". Only override the invoice's own values.
  useEffect(() => {
    if (prefilled || invoice.locationCountryCode) return
    let active = true
    fetch('/api/me/profile', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((p: { country?: string; regionCode?: string | null } | null) => {
        if (!active || !p) return
        if (p.country) setCountry(p.country)
        if (p.regionCode) setRegionCode(p.regionCode)
      })
      .catch(() => undefined)
      .finally(() => { if (active) setPrefilled(true) })
    return () => { active = false }
  }, [prefilled, invoice.locationCountryCode])

  // Region options follow the selected country (ISO 3166-2 reference list). Drop any
  // pre-seeded region that isn't a real subdivision of the loaded country — a PENDING
  // invoice carries the unmapped country-code fallback (e.g. 'NL'), and submitting that
  // unchanged would force the invoice into HELD_UNMAPPED instead of resolving it.
  useEffect(() => {
    let active = true
    fetch(`/api/reference/regions?country=${country}`)
      .then((res) => (res.ok ? res.json() : { subdivisions: [] }))
      .then((data: { subdivisions?: Region[] }) => {
        if (!active) return
        const subs = data.subdivisions ?? []
        setRegions(subs)
        setRegionCode((cur) => (cur && !subs.some((s) => s.code === cur) ? '' : cur))
      })
      .catch(() => { if (active) setRegions([]) })
    return () => { active = false }
  }, [country])

  if (invoice.locationStatus === 'HELD_UNMAPPED') {
    return (
      <div style={banner} data-testid="invoice-location-held">
        <span className="dd-label" style={{ fontWeight: 600 }}><Clock size={14} /> Location on hold</span>
        <span className="fb-hint">
          We don’t cover this area in the price index yet. Your receipt is saved and its prices
          will join the regional index once we map the region.
        </span>
      </div>
    )
  }

  // A still-processing or duplicate invoice can be PENDING but isn't eligible — hide
  // the prompt so the user can't submit a confirmation the backend will reject (409).
  if (invoice.locationStatus !== 'PENDING' || !invoice.locationConfirmable) return null

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: country, regionCode }),
      })
      if (!res.ok) {
        if (res.status === 409) throw new Error('This receipt’s location was already set.')
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Couldn’t save the location. Please try again.')
      }
      const data = (await res.json()) as { locationStatus: 'RESOLVED' | 'HELD_UNMAPPED' }
      onConfirmed(data.locationStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const needsRegion = regions.length > 0

  return (
    <div style={banner} data-testid="invoice-location-gate">
      <span className="dd-label" style={{ fontWeight: 600 }}><ShieldAlert size={14} /> Confirm where you shopped</span>
      <span className="fb-hint">
        We couldn’t tell which region this receipt is from. Confirm it so your anonymized prices
        can help the regional index. This can only be set once.
      </span>

      <label className="dd-label" style={{ gap: 6 }}><MapPin size={13} /> Country</label>
      <select
        className="auth-select"
        value={country}
        onChange={(e) => { setCountry(e.target.value); setRegionCode('') }}
        data-testid="invoice-location-country"
        style={{ width: '100%' }}
      >
        {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>

      {needsRegion && (
        <>
          <label className="dd-label" style={{ gap: 6 }}><MapPin size={13} /> Region</label>
          <select
            className="auth-select"
            value={regionCode}
            onChange={(e) => setRegionCode(e.target.value)}
            data-testid="invoice-location-region"
            style={{ width: '100%' }}
          >
            <option value="">Select your region…</option>
            {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </>
      )}

      {error && <span className="field-error" role="alert" data-testid="invoice-location-error">{error}</span>}

      <Button
        variant="primary"
        onClick={submit}
        disabled={submitting || (needsRegion && !regionCode)}
        style={{ width: '100%' }}
        data-testid="invoice-location-submit"
      >
        {submitting ? 'Saving…' : 'Confirm location'}
      </Button>
    </div>
  )
}
