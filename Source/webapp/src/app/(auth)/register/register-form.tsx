'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { ChevronDown, Globe, Languages, Lock, Mail, User, Wallet } from 'lucide-react'
import { Button } from '@/components/ds/Button'
import { Input } from '@/components/ds/Input'
import { registerUser } from '../actions'

interface Country {
  code: string
  name: string
  currency: string
  symbol: string
  defaultLanguage: string
}

const COUNTRIES: Country[] = [
  { code: 'BR', name: 'Brazil',         currency: 'BRL', symbol: 'R$', defaultLanguage: 'pt-BR' },
  { code: 'CA', name: 'Canada',         currency: 'CAD', symbol: 'C$', defaultLanguage: 'en'    },
  { code: 'FR', name: 'France',         currency: 'EUR', symbol: '€',  defaultLanguage: 'fr'    },
  { code: 'DE', name: 'Germany',        currency: 'EUR', symbol: '€',  defaultLanguage: 'de'    },
  { code: 'IT', name: 'Italy',          currency: 'EUR', symbol: '€',  defaultLanguage: 'it'    },
  { code: 'NL', name: 'Netherlands',    currency: 'EUR', symbol: '€',  defaultLanguage: 'nl'    },
  { code: 'PT', name: 'Portugal',       currency: 'EUR', symbol: '€',  defaultLanguage: 'pt-BR' },
  { code: 'ES', name: 'Spain',          currency: 'EUR', symbol: '€',  defaultLanguage: 'en'    },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£',  defaultLanguage: 'en'    },
  { code: 'US', name: 'United States',  currency: 'USD', symbol: '$',  defaultLanguage: 'en'    },
]

const LANGUAGES = [
  { code: 'nl',    label: 'Nederlands' },
  { code: 'en',    label: 'English' },
  { code: 'fr',    label: 'Français' },
  { code: 'de',    label: 'Deutsch' },
  { code: 'it',    label: 'Italiano' },
  { code: 'pt-BR', label: 'Português (BR)' },
]

const DEFAULT_COUNTRY = COUNTRIES.find((c) => c.code === 'NL') ?? COUNTRIES[0]

function scorePassword(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[0-9]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/[A-Z]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(4, s) as 0 | 1 | 2 | 3 | 4
}

const STRENGTH = [
  { label: '', tone: '' as const },
  { label: 'Weak', tone: 'danger' as const },
  { label: 'Fair', tone: 'warning' as const },
  { label: 'Good', tone: 'warning' as const },
  { label: 'Strong', tone: 'success' as const },
]

export function RegisterForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY)
  const [language, setLanguage] = useState(DEFAULT_COUNTRY.defaultLanguage)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')

  const score = scorePassword(pw)
  const meter = STRENGTH[score]
  const mismatch = confirm.length > 0 && confirm !== pw

  function handleCountryChange(code: string) {
    const c = COUNTRIES.find((x) => x.code === code) ?? DEFAULT_COUNTRY
    setCountry(c)
    setLanguage(c.defaultLanguage)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const password = form.get('password') as string
    const confirmField = form.get('confirm') as string

    if (password !== confirmField) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const result = await registerUser(
      form.get('email') as string,
      password,
      form.get('fullName') as string,
      country.code,
      language,
      country.currency,
    )

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    const signInResult = await signIn('credentials', {
      email: form.get('email'),
      password,
      redirect: false,
    })

    setLoading(false)

    if (signInResult?.error) {
      router.push('/login?registered=1')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" data-testid="register-form" noValidate>
      <Input
        label="Full name"
        type="text"
        name="fullName"
        autoComplete="name"
        icon={<User size={16} />}
        placeholder="Antonio Reuter"
        required
        data-testid="register-fullName"
      />

      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        icon={<Mail size={16} />}
        placeholder="you@example.com"
        required
        data-testid="register-email"
      />

      <div className="pw-field">
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          icon={<Lock size={16} />}
          placeholder="At least 12 characters"
          required
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          data-testid="register-password"
        />
        <div className="pw-meter" aria-hidden>
          <div className="pw-track">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`pw-seg ${i <= score && meter.tone ? `on tone-${meter.tone}` : ''}`}
              />
            ))}
          </div>
          {meter.label && (
            <span className="pw-label" style={{ color: `var(--${meter.tone})` }}>
              {meter.label}
            </span>
          )}
        </div>
        <p className="field-hint">
          Min. 12 characters with uppercase, lowercase, number, and symbol.
        </p>
      </div>

      <div className="pw-field">
        <Input
          label="Confirm password"
          type="password"
          name="confirm"
          autoComplete="new-password"
          icon={<Lock size={16} />}
          placeholder="Re-enter your password"
          required
          flagged={mismatch}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          data-testid="register-confirm"
        />
        {mismatch && <span className="field-error">Passwords don&apos;t match.</span>}
      </div>

      <div className="auth-grid-2">
        <div className="auth-field">
          <label htmlFor="country" className="auth-field-label">
            Country
          </label>
          <div className="auth-control-wrap">
            <span className="lead-icon">
              <Globe size={16} />
            </span>
            <select
              id="country"
              name="country"
              className="auth-select"
              value={country.code}
              onChange={(e) => handleCountryChange(e.target.value)}
              data-testid="register-country"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="chevron">
              <ChevronDown size={16} />
            </span>
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-field-label">Display currency</label>
          <div className="auth-control-wrap">
            <span className="lead-icon">
              <Wallet size={16} />
            </span>
            <div className="auth-static" data-testid="register-currency" aria-readonly="true">
              <span>
                {country.currency} · {country.symbol}
              </span>
              <span className="auto-tag">Auto</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-field">
        <label htmlFor="language" className="auth-field-label">
          Preferred language
        </label>
        <div className="auth-control-wrap">
          <span className="lead-icon">
            <Languages size={16} />
          </span>
          <select
            id="language"
            name="language"
            className="auth-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            data-testid="register-language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <span className="chevron">
            <ChevronDown size={16} />
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="field-error" data-testid="register-error">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={loading}
        style={{ width: '100%' }}
        iconLeft={loading ? null : <User size={16} />}
        data-testid="register-submit"
      >
        {loading ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}
