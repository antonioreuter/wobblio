// Shared SQL fragment builders for the data-intelligence adapters. Keeping the bind index derived
// from the params array (never hand-numbered) removes the off-by-one risk when the same optional
// filter is used across several queries.

// Appends the currency to `params` and returns `AND <column> = $<n>` when a currency is given,
// or '' to skip the filter. `<n>` is always the just-pushed position, so callers never track it.
export function currencyFilter(column: string, currency: string | null, params: unknown[]): string {
  if (currency === null) return '';
  params.push(currency);
  return `AND ${column} = $${params.length}`;
}
