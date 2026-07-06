interface FormatMoneyOptions {
  currency?: string
  locale?: string
  showSign?: boolean
}

export function formatMoney(
  amount: number,
  { currency = 'EUR', locale = 'nl-NL', showSign = false }: FormatMoneyOptions = {}
): string {
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))

  if (showSign && amount !== 0) {
    return amount > 0 ? `+${formatted}` : `-${formatted}`
  }
  return amount < 0 ? `-${formatted}` : formatted
}

export function formatDelta(value: number, suffix = '%'): string {
  const sign = value >= 0 ? '▲' : '▼'
  return `${sign} ${Math.abs(value).toFixed(1)}${suffix}`
}

// Money for a single-currency view (price-trends §6.5 honesty). When the currency is unresolved
// (null — unmapped country with nothing to infer from), renders a bare number rather than
// asserting euros, matching currencySymbol(null)===''. One source for the chart axis, tooltip,
// legend, and table so they never disagree on the same amount.
export function formatViewMoney(amount: number, currency: string | null, locale = 'nl-NL'): string {
  if (!currency) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }
  return formatMoney(amount, { currency, locale })
}

export function formatCompact(amount: number, locale = 'nl-NL'): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(amount)
}
