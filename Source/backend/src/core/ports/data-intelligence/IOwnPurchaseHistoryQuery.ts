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
  // View currency (ISO-4217): invoices in other currencies are excluded so a foreign-currency
  // pending-location receipt can't leak into an unrelated view's medians (§6.5). null skips the
  // filter (only when the currency can't be resolved).
  currency: string | null;
}

// One line per product, on the same weekly-median shape as the public trend so the webapp
// overlays both on a single week axis.
export interface OwnPurchaseLine {
  productId: string;
  points: WeeklyMedianPoint[];
  purchaseCount: number; // total own purchase lines in the window
  lastPurchasedOn: string; // ISO date of the most recent own purchase
  // The two most recent *regular-price* purchase events (§6.5.5 "% change vs last scan"), unit-
  // consistent with the medians (€/unit when size known, else €/item). `lastPrice` is the most
  // recent; `previousPrice` the one before it, null when the product was bought only once.
  lastPrice: number | null;
  previousPrice: number | null;
  // Comparable unit when every own line for this product shares a known pack size (median is
  // €/unit); null when size is unknown (median is €/item).
  unit: BaseUnit | null;
}

// Region scope for resolving the modal currency of the caller's own receipts (no currency filter).
export interface OwnRegionCurrencyInput {
  productIds: string[];
  countryCode: string;
  regionCode: string;
  weeks: number;
}

export interface IOwnPurchaseHistoryQuery {
  history(input: OwnPurchaseQueryInput): Promise<OwnPurchaseLine[]>;
  // Most frequent currency across the caller's own receipts in the region, or null when they have
  // none. The view currency prefers this over the public modal for an unmapped country so the
  // currency filter never hides the user's own purchases.
  modalCurrency(input: OwnRegionCurrencyInput): Promise<string | null>;
}
