// Shared SQL fragment builders for the data-intelligence adapters. Keeping the bind index derived
// from the params array (never hand-numbered) removes the off-by-one risk when the same optional
// filter is used across several queries.

// Appends the currency to `params` and returns `AND <column> = $<n>` when a currency is given,
// or '' to skip the filter. `<n>` is always the just-pushed position, so callers never track it.
//
// Intentionally STRICT: a row whose currency is NULL (unknown) never matches `= $n` and is
// excluded. This is the right policy for the price-COMPARISON surfaces that use this helper
// (inflation baskets, switching savings, own-purchase trend, optimizer averages): a median or
// index must not blend prices whose currency can't be trusted to be the view currency, and an
// unknown currency could be foreign — dropping it is the conservative, correct choice.
//
// This deliberately DIFFERS from the spend-TOTAL surfaces (compute_budget_spend, top merchants,
// dashboard MTD), which instead include `OR <column> IS NULL` so a legacy pre-FX row still counts
// at home-currency face value. There, under-counting a user's own spend is worse than the small
// risk of a mislabeled legacy row; in a shared price index that same risk corrupts the median, so
// the two categories keep opposite NULL-currency policies on purpose. Do not "unify" them.
export function currencyFilter(column: string, currency: string | null, params: unknown[]): string {
  if (currency === null) return '';
  params.push(currency);
  return `AND ${column} = $${params.length}`;
}
