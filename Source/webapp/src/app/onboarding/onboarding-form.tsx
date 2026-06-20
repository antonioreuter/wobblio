'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { federatedSignOut } from '@/lib/federated-sign-out'
import { AlertCircle, Cake, Check, ChevronDown, Globe, Languages, MapPin, User, Wallet } from 'lucide-react'
import { Button } from '@/components/ds/Button'
import { Input } from '@/components/ds/Input'
import { Checkbox } from '@/components/ds/Checkbox'
import { COUNTRIES, LANGUAGES, DEFAULT_COUNTRY, type Country } from '@/lib/locale-options'

const TODAY = new Date().toISOString().slice(0, 10)

export function OnboardingForm() {
  const { data: session } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [loading, setLoading] = useState(false)
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY)
  const [language, setLanguage] = useState(DEFAULT_COUNTRY.defaultLanguage)
  const [consent, setConsent] = useState(false)
  const [regions, setRegions] = useState<{ code: string; name: string }[]>([])
  const [regionCode, setRegionCode] = useState('')

  // Region (state/province) options are driven by the selected country, from the
  // ISO 3166-2 reference table. A failed/empty lookup degrades gracefully — the
  // backend then stores the country code as the region.
  useEffect(() => {
    let active = true
    setRegions([])
    setRegionCode('')
    fetch(`/api/reference/regions?country=${country.code}`)
      .then((res) => (res.ok ? res.json() : { subdivisions: [] }))
      .then((data: { subdivisions?: { code: string; name: string }[] }) => {
        if (active) setRegions(data.subdivisions ?? [])
      })
      .catch(() => {
        if (active) setRegions([])
      })
    return () => {
      active = false
    }
  }, [country.code])

  function handleCountryChange(code: string) {
    const c = COUNTRIES.find((x) => x.code === code) ?? DEFAULT_COUNTRY
    setCountry(c)
    setLanguage(c.defaultLanguage)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const form = new FormData(e.currentTarget)
    const fullName = (form.get('fullName') as string).trim()
    const birthdate = form.get('birthdate') as string

    if (!fullName) return setError('Please enter your full name.')
    if (!birthdate) return setError('Please enter your date of birth.')
    if (regions.length > 0 && !regionCode) return setError('Please select your region.')
    if (!consent) return setError('Please accept the privacy terms to continue.')

    setLoading(true)
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName,
        country: country.code,
        regionCode,
        language,
        currency: country.currency,
        birthdate,
        consent,
      }),
    })

    if (!res.ok) {
      // A 401 means the session is no longer valid (expired/revoked, or from
      // before an auth change). Prompt an explicit re-auth rather than a silent
      // redirect — avoids login loops and doesn't mask backend errors.
      if (res.status === 401) {
        setExpired(true)
        setLoading(false)
        return
      }
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? 'Could not save your profile. Please try again.')
      setLoading(false)
      return
    }

    // Hard navigation (full document load), not a soft router push: the session
    // token's onboarded flag cannot be refreshed mid-session (update() does not
    // persist under OpenNext), so we rely on the server gate re-deriving onboarding
    // from the DB on a fresh request. A soft navigation would replay the cached
    // gate redirect and loop.
    window.location.assign('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" data-testid="onboarding-form" noValidate>
      <Input
        label="Full name"
        type="text"
        name="fullName"
        autoComplete="name"
        icon={<User size={16} />}
        placeholder="Your full name"
        defaultValue={session?.user?.name ?? ''}
        required
        data-testid="onboarding-fullName"
      />

      <Input
        label="Date of birth"
        type="date"
        name="birthdate"
        max={TODAY}
        icon={<Cake size={16} />}
        required
        data-testid="onboarding-birthdate"
      />

      <div className="auth-grid-2">
        <div className="auth-field">
          <label htmlFor="country" className="auth-field-label">Country</label>
          <div className="auth-control-wrap">
            <span className="lead-icon"><Globe size={16} /></span>
            <select
              id="country"
              name="country"
              className="auth-select"
              value={country.code}
              onChange={(e) => handleCountryChange(e.target.value)}
              data-testid="onboarding-country"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            <span className="chevron"><ChevronDown size={16} /></span>
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-field-label">Display currency</label>
          <div className="auth-control-wrap">
            <span className="lead-icon"><Wallet size={16} /></span>
            <div className="auth-static" data-testid="onboarding-currency" aria-readonly="true">
              <span>{country.currency} · {country.symbol}</span>
              <span className="auto-tag">Auto</span>
            </div>
          </div>
        </div>
      </div>

      {regions.length > 0 && (
        <div className="auth-field">
          <label htmlFor="region" className="auth-field-label">Region</label>
          <div className="auth-control-wrap">
            <span className="lead-icon"><MapPin size={16} /></span>
            <select
              id="region"
              name="region"
              className="auth-select"
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              data-testid="onboarding-region"
            >
              <option value="">Select your region…</option>
              {regions.map((r) => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </select>
            <span className="chevron"><ChevronDown size={16} /></span>
          </div>
        </div>
      )}

      <div className="auth-field">
        <label htmlFor="language" className="auth-field-label">Preferred language</label>
        <div className="auth-control-wrap">
          <span className="lead-icon"><Languages size={16} /></span>
          <select
            id="language"
            name="language"
            className="auth-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            data-testid="onboarding-language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <span className="chevron"><ChevronDown size={16} /></span>
        </div>
      </div>

      <div className="auth-consent">
        <Checkbox
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          data-testid="onboarding-consent"
          label="I agree to Wobblio processing my data per the privacy policy (GDPR), including anonymized price contributions to the regional price index."
        />
      </div>

      {expired ? (
        <div role="alert" className="auth-alert" data-testid="onboarding-session-expired">
          <AlertCircle size={16} />
          <div className="auth-alert-body">
            <span className="auth-alert-msg">
              Your session expired. Please sign in again to finish setting up your account.
            </span>
            <Button
              type="button"
              variant="primary"
              style={{ width: '100%' }}
              onClick={() => void federatedSignOut()}
              data-testid="onboarding-reauth"
            >
              Sign in again
            </Button>
          </div>
        </div>
      ) : (
        error && (
          <div role="alert" className="auth-alert" data-testid="onboarding-error">
            <AlertCircle size={16} />
            <span className="auth-alert-msg">{error}</span>
          </div>
        )
      )}

      {!expired && (
        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          style={{ width: '100%' }}
          iconLeft={loading ? null : <Check size={16} />}
          data-testid="onboarding-submit"
        >
          {loading ? 'Saving…' : 'Finish setup'}
        </Button>
      )}
    </form>
  )
}
