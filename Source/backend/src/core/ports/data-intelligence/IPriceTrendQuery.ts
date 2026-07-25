// §6.5.1 comparison read model (Premium reporting, the 3-product / 26-week chart).
// Reads the global, RLS-exempt price_observation store. Separate from the write-only
// IPriceObservationStore (ISP): emission and serving are distinct capabilities.

import type { SizeSource } from '../../domain/unitSize';

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
  // Weekly median of the pack price paid (line_total ÷ quantity) — the only price signal
  // (fix 09/01). Never per-unit. null if the week had only discounts.
  median: number | null;
  discountMedian: number | null; // weekly median of discounted observations, rendered as distinct markers
}

// Descriptive size metadata for a series' product (fix 09/01): a chip like "2L" shown next to
// the name, never a per-unit price basis. sizeText is null when the size is unknown.
export interface SeriesSize {
  sizeText: string | null;
  sizeSource: SizeSource | null; // RECEIPT (catalog/printed) | USER (annotated) | null (unknown)
}

// One served line per (product, merchant) cell that clears the k≥3 gate in the SQL.
export interface PriceTrendLine {
  productId: string;
  merchantId: string;
  merchantName: string;
  points: WeeklyMedianPoint[];
  observationCount: number; // distinct non-quarantined observations in the window (≥ kMin)
  lastObservedOn: string; // ISO date — drives staleness greying upstream
  // Descriptive pack size for this (product, merchant) series — a chip, not a price basis.
  size: SeriesSize;
  // 09/05 price-ambiguity flag: the (product, merchant) name may cover different SKUs (bimodal
  // history). Drives the trend banner; such a series is never crowned or fed to the optimizer.
  ambiguous: boolean;
}

// Per-product observation stats over the region, for diagnosing WHY a selected product produced no
// served market line (fix 10). Only products with at least one non-quarantined region row (any time,
// any currency) appear; a requested product absent from the result has no region observations at all.
export interface ProductObservationStats {
  productId: string;
  inWindowCurrencyCount: number; // rows in the window AND view currency (what the k≥3 cell gate sees)
  otherCurrencyInWindowCount: number; // rows in the window but a DIFFERENT currency than the view
  maxCellCount: number; // largest single-merchant count in window+currency (how close to k≥3)
  merchantCount: number; // distinct merchants with ≥1 in-window+currency observation
}

export interface IPriceTrendQuery {
  comparison(input: PriceTrendQueryInput): Promise<PriceTrendLine[]>;
  // Region observation stats for the requested products (fix 10 diagnostics). Called only when some
  // requested product has no served line, so the UI can say WHY instead of showing a blank chart.
  productDiagnostics(input: PriceTrendQueryInput): Promise<ProductObservationStats[]>;
  // Most frequent observation currency in the region for the selected products, or null when the
  // region has no observations. Used as the fallback view currency when the country isn't mapped.
  modalCurrency(input: RegionCurrencyQueryInput): Promise<string | null>;
  // Distinct non-quarantined merchants tracking any selected product in the region, BEFORE the k≥3
  // gate — the max over the selected products. Drives the cold-start motivator ("N stores tracked
  // in your area") even when no cell clears the gate. 0 when nothing is tracked yet.
  regionMerchantCount(input: PriceTrendQueryInput): Promise<number>;
}
