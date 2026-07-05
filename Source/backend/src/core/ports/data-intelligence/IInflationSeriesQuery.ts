import type { MonthlyProductMedian } from '../../domain/inflationSeries';

// Per-month, per-product median comparable prices feeding the inflation sparkline. Two capabilities,
// same row shape, different sources: the caller's own RLS-scoped invoices, and the de-identified
// regional price_observation store. Split per ISP so each carries only the inputs it needs.

export interface PersonalSeriesInput {
  months: number; // how many trailing calendar months to return, including the current one
}

export interface IPersonalInflationSeriesQuery {
  monthlyMedians(input: PersonalSeriesInput): Promise<MonthlyProductMedian[]>;
}

export interface RegionSeriesInput {
  regionCode: string;
  months: number;
  minObservations?: number; // §6.8 per-month serving gate k; defaults to 3
}

export interface IRegionInflationSeriesQuery {
  monthlyMedians(input: RegionSeriesInput): Promise<MonthlyProductMedian[]>;
}
