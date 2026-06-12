'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { registerUser } from '../actions'

interface Country {
  code: string
  name: string
  currency: string
  defaultLanguage: string
}

const COUNTRIES: Country[] = [
  { code: 'BR', name: 'Brazil',         currency: 'BRL', defaultLanguage: 'pt-BR' },
  { code: 'CA', name: 'Canada',         currency: 'CAD', defaultLanguage: 'en'    },
  { code: 'FR', name: 'France',         currency: 'EUR', defaultLanguage: 'fr'    },
  { code: 'DE', name: 'Germany',        currency: 'EUR', defaultLanguage: 'de'    },
  { code: 'IT', name: 'Italy',          currency: 'EUR', defaultLanguage: 'it'    },
  { code: 'NL', name: 'Netherlands',    currency: 'EUR', defaultLanguage: 'nl'    },
  { code: 'PT', name: 'Portugal',       currency: 'EUR', defaultLanguage: 'pt-BR' },
  { code: 'ES', name: 'Spain',          currency: 'EUR', defaultLanguage: 'en'    },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', defaultLanguage: 'en'    },
  { code: 'US', name: 'United States',  currency: 'USD', defaultLanguage: 'en'    },
]

const LANGUAGES = [
  { code: 'nl',    label: 'Dutch' },
  { code: 'en',    label: 'English' },
  { code: 'fr',    label: 'French' },
  { code: 'de',    label: 'German' },
  { code: 'it',    label: 'Italian' },
  { code: 'pt-BR', label: 'Portuguese (pt-BR)' },
]

const CURRENCY_LABELS: Record<string, string> = {
  EUR: 'EUR — Euro',
  GBP: 'GBP — British Pound',
  USD: 'USD — US Dollar',
  CAD: 'CAD — Canadian Dollar',
  BRL: 'BRL — Brazilian Real',
}

const DEFAULT_COUNTRY = COUNTRIES.find(c => c.code === 'NL') ?? COUNTRIES[0]

const inputClass =
  'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[16px] text-[#0F172A] outline-none transition focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] dark:border-[#1E293B] dark:bg-[#0B0F19] dark:text-[#F1F5F9]'

export function RegisterForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY)
  const [language, setLanguage] = useState(DEFAULT_COUNTRY.defaultLanguage)

  function handleCountryChange(code: string) {
    const country = COUNTRIES.find(c => c.code === code) ?? DEFAULT_COUNTRY
    setSelectedCountry(country)
    setLanguage(country.defaultLanguage)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const password = form.get('password') as string
    const confirm  = form.get('confirm')  as string

    if (password !== confirm) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const result = await registerUser(
      form.get('email') as string,
      password,
      form.get('fullName') as string,
      selectedCountry.code,
      language,
      selectedCountry.currency,
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
    <form onSubmit={handleSubmit} data-testid="register-form" noValidate>
      <div className="flex flex-col gap-4">

        {/* Full name */}
        <div>
          <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            data-testid="register-fullName"
            className={inputClass}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            data-testid="register-email"
            className={inputClass}
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            data-testid="register-password"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Min. 12 characters with uppercase, lowercase, number, and symbol.
          </p>
        </div>

        {/* Confirm password */}
        <div>
          <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">
            Confirm password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            data-testid="register-confirm"
            className={inputClass}
          />
        </div>

        {/* Country */}
        <div>
          <label htmlFor="country" className="mb-1 block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">
            Country
          </label>
          <select
            id="country"
            name="country"
            required
            value={selectedCountry.code}
            onChange={e => handleCountryChange(e.target.value)}
            data-testid="register-country"
            className={inputClass}
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Language */}
        <div>
          <label htmlFor="language" className="mb-1 block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">
            Preferred language
          </label>
          <select
            id="language"
            name="language"
            value={language}
            onChange={e => setLanguage(e.target.value)}
            data-testid="register-language"
            className={inputClass}
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Currency — derived, read-only */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">
            Currency
          </label>
          <div
            data-testid="register-currency"
            className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[16px] text-[#64748B] dark:border-[#1E293B] dark:bg-[#0B0F19] dark:text-[#94A3B8]"
          >
            {CURRENCY_LABELS[selectedCountry.currency] ?? selectedCountry.currency}
          </div>
          <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Set automatically from your country.
          </p>
        </div>

      </div>

      {error && (
        <p role="alert" data-testid="register-error" className="mt-4 text-sm text-[#DC2626]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        data-testid="register-submit"
        className="mt-5 w-full rounded-lg bg-[#0D9488] px-4 py-2.5 text-[16px] font-medium text-white transition hover:bg-[#0F766E] disabled:opacity-60"
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}
