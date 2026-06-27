import type { WeeklyMedianPoint } from './IPriceTrendQuery';
import type { BaseUnit } from '../../domain/unitSize';

// The caller's OWN purchase history for the comparison chart — read from the RLS-scoped
// invoice_line store, NOT the de-identified price_observation store. No quorum gate: a
// product the user alone bought (still pre-quorum / provisional in the global catalog) is
// exactly what this exists to surface. Tenant context MUST be set before any call (the
// invoice/invoice_line RLS policies silently return zero rows otherwise). Keyed by product
// only (one line per product). Lines with product_id IS NULL (unmatched by the pipeline)
// cannot be tied to a selected product and are excluded.

export interface OwnPurchaseQueryInput {
  productIds: string[]; // 1..3 selected products
  countryCode: string; // ISO 3166-1 alpha-2 — matches the selected region's country
  regionCode: string; // ISO 3166-2 — same picker that drives the public trend
  weeks: number; // trailing window length, in weeks
}

// One line per product, on the same weekly-median shape as the public trend so the webapp
// overlays both on a single week axis.
export interface OwnPurchaseLine {
  productId: string;
  points: WeeklyMedianPoint[];
  purchaseCount: number; // total own purchase lines in the window
  lastPurchasedOn: string; // ISO date of the most recent own purchase
  // Comparable unit when every own line for this product shares a known pack size (median is
  // €/unit); null when size is unknown (median is €/item).
  unit: BaseUnit | null;
}

export interface IOwnPurchaseHistoryQuery {
  history(input: OwnPurchaseQueryInput): Promise<OwnPurchaseLine[]>;
}
