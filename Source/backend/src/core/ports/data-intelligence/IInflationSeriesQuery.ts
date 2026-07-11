import type { MonthlyProductMedian } from '../../domain/inflationSeries';

// Per-month, per-product median comparable prices feeding the inflation sparkline. Two capabilities,
// same row shape, different sources: the caller's own RLS-scoped invoices, and the de-identified
// regional price_observation store. Split per ISP so each carries only the inputs it needs.

export interface PersonalSeriesInput {
  months: number; // how many trailing calendar months to return, including the current one
  // Caller's home currency; other-currency receipts are excluded so a product's monthly series
  // never blends currencies. Null (unresolved) omits the filter.
  homeCurrency: string | null;
}

export interface IPersonalInflationSeriesQuery {
  monthlyMedians(input: PersonalSeriesInput): Promise<MonthlyProductMedian[]>;
}

export interface RegionSeriesInput {
  regionCode: string;
  // The region's country (region_code alone is not globally unique) and the view currency; both
  // gate the de-identified store so a region's series is single-country and single-currency.
  countryCode: string;
  currency: string | null;
  months: number;
  minObservations?: number; // §6.8 per-month serving gate k; defaults to 3
}

export interface IRegionInflationSeriesQuery {
  monthlyMedians(input: RegionSeriesInput): Promise<MonthlyProductMedian[]>;
}
