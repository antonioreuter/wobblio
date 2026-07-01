// ECB reference rates are EUR-base only: a stored row means `1 EUR = rate × quote`.
// Cross-currency conversion is derived from two EUR legs by the harmonization service.
export interface IFxRateRepository {
  // Upsert a day's EUR-base rates. Returns the number of rows written.
  upsertDaily(date: string, base: string, rows: { quote: string; rate: number }[]): Promise<number>;
  // EUR→quote rate for the exact date, else the latest strictly-prior date (spec fallback).
  // `EUR` resolves to 1 without a query. Null when no rate exists on or before the date.
  latestOnOrBefore(quote: string, onDate: string): Promise<number | null>;
}
