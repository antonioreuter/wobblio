// The expected ISO-4217 currency for a country, for the price-trends report's currency-honesty
// filter (§6.5, sub-spec price-trends-gaps/02). The report is about *a region's* prices, so the
// honest unit is the currency actually charged there — independent of who is viewing (not the
// caller's home_currency). Data-minimal: the launch market (NL/EUR) plus the countries the user
// operates across. Unknown countries return null; the caller then falls back to the modal currency
// of the matched observations so a view is never blended across currencies. This is a domain
// constant, not a DB table — no DDL, no reference data.

const COUNTRY_CURRENCY: Record<string, string> = {
  // Eurozone (launch market + neighbouring operating countries)
  NL: 'EUR', BE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', PT: 'EUR',
  IE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR',
  // Non-euro European + common travel destinations
  GB: 'GBP', CH: 'CHF', DK: 'DKK', SE: 'SEK', NO: 'NOK', PL: 'PLN', CZ: 'CZK',
  US: 'USD',
};

// The expected currency for a country, or null when the country isn't mapped. Case-insensitive
// on the ISO 3166-1 alpha-2 code.
export function countryCurrency(iso2: string): string | null {
  return COUNTRY_CURRENCY[iso2.trim().toUpperCase()] ?? null;
}
