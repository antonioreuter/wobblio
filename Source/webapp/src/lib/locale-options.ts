// Shared country/language options for registration + onboarding forms.

export interface Country {
  code: string
  name: string
  currency: string
  symbol: string
  defaultLanguage: string
}

export const COUNTRIES: Country[] = [
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

export const LANGUAGES = [
  { code: 'nl',    label: 'Nederlands' },
  { code: 'en',    label: 'English' },
  { code: 'fr',    label: 'Français' },
  { code: 'de',    label: 'Deutsch' },
  { code: 'it',    label: 'Italiano' },
  { code: 'pt-BR', label: 'Português (BR)' },
]

export const DEFAULT_COUNTRY = COUNTRIES.find((c) => c.code === 'NL') ?? COUNTRIES[0]
