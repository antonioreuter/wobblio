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

export function formatCompact(amount: number, locale = 'nl-NL'): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(amount)
}
