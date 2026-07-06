// §6.5.1 comparison read model (Premium reporting, the 3-product / 26-week chart).
// Reads the global, RLS-exempt price_observation store. Separate from the write-only
// IPriceObservationStore (ISP): emission and serving are distinct capabilities.

import type { BaseUnit } from '../../domain/unitSize';

export interface PriceTrendQueryInput {
  productIds: string[]; // 1..3 selected products
  countryCode: string; // ISO 3166-1 alpha-2
  regionCode: string; // ISO 3166-2 (coarse postal-prefix region)
  weeks: number; // trailing window length, in weeks
  kMin: number; // §6.5 Gate 2: suppress a cell below this many distinct observations
  // View currency (ISO-4217): observations in other currencies are excluded so medians are never
  // blended across currencies (§6.5, currency honesty — no FX). null skips the filter (only when
  // the currency can't be resolved at all).
  currency: string | null;
}

// Region scope for resolving the modal (most frequent) currency when the picker country has no
// currency mapping — used to keep an unmapped-country view single-currency.
export interface RegionCurrencyQueryInput {
  productIds: string[];
  countryCode: string;
  regionCode: string;
  weeks: number;
}

export interface WeeklyMedianPoint {
  weekStart: string; // ISO date, Monday of the bucket
  // Weekly median price. Its meaning follows the line's `unit`: €/unit when the cell's pack
  // size is known, otherwise €/item (pack price). null if the week had only discounts.
  median: number | null;
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
  // The comparable unit when every observation in the cell carries the same known pack size
  // (median is €/unit); null when pack size is unknown (median is €/item — not cross-comparable).
  unit: BaseUnit | null;
}

export interface IPriceTrendQuery {
  comparison(input: PriceTrendQueryInput): Promise<PriceTrendLine[]>;
  // Most frequent observation currency in the region for the selected products, or null when the
  // region has no observations. Used as the fallback view currency when the country isn't mapped.
  modalCurrency(input: RegionCurrencyQueryInput): Promise<string | null>;
  // Distinct non-quarantined merchants tracking any selected product in the region, BEFORE the k≥3
  // gate — the max over the selected products. Drives the cold-start motivator ("N stores tracked
  // in your area") even when no cell clears the gate. 0 when nothing is tracked yet.
  regionMerchantCount(input: PriceTrendQueryInput): Promise<number>;
}
