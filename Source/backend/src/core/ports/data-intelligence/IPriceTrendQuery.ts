// §6.5.1 comparison read model (Premium reporting, the 3-product / 26-week chart).
// Reads the global, RLS-exempt price_observation store. Separate from the write-only
// IPriceObservationStore (ISP): emission and serving are distinct capabilities.

export interface PriceTrendQueryInput {
  productIds: string[]; // 1..3 selected products
  countryCode: string; // ISO 3166-1 alpha-2
  regionCode: string; // ISO 3166-2 (coarse postal-prefix region)
  weeks: number; // trailing window length, in weeks
  kMin: number; // §6.5 Gate 2: suppress a cell below this many distinct observations
}

export interface WeeklyMedianPoint {
  weekStart: string; // ISO date, Monday of the bucket
  median: number | null; // weekly median of non-discounted normalized unit price (null if only discounts)
  discountMedian: number | null; // weekly median of discounted observations, rendered as distinct markers
}

// One served line per (product, merchant) cell that clears the k≥3 gate in the SQL.
export interface PriceTrendLine {
  productId: string;
  merchantId: string;
  merchantName: string;
  points: WeeklyMedianPoint[];
  observationCount: number; // distinct non-quarantined observations in the window (≥ kMin)
  lastObservedOn: string; // ISO date — drives staleness greying upstream
}

export interface IPriceTrendQuery {
  comparison(input: PriceTrendQueryInput): Promise<PriceTrendLine[]>;
}
