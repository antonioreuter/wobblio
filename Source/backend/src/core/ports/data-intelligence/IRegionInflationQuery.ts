import type { MatchedBasketItem } from '../../domain/personalInflation';

// The matched basket for a REGION's inflation, read from the de-identified, RLS-exempt
// price_observation store (§6.5) — no tenant context, no user/invoice reference. Only products
// that clear the §6.8 serving quorum (≥ minObservations non-quarantined, non-discounted
// observations) in BOTH periods are returned, so a thin or unpromoted product never drives the
// regional headline. Price basis mirrors the personal query: €/unit when every observation for a
// product carries a per-unit price and one base unit, else €/item (pack price).
export interface RegionInflationInput {
  regionCode: string; // ISO 3166-2, country-qualified (e.g. 'NL-NB')
  // The region's country (region_code alone is not globally unique) and the view currency; both
  // gate the store so a region's basket is single-country and single-currency (never blends, say,
  // BRL and EUR observations). currency null omits only the currency filter.
  countryCode: string;
  currency: string | null;
  // Current = [today-windowDays, today]; prior = the window immediately before it.
  windowDays: number;
  // §6.8 read-time serving gate k. Defaults to MIN_REGION_OBSERVATIONS.
  minObservations?: number;
}

export interface IRegionInflationQuery {
  matchedBasket(input: RegionInflationInput): Promise<MatchedBasketItem[]>;
}
