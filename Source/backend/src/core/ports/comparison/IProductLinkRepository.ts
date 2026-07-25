// Fix 10 — silent cross-merchant product links (replacing 09/04 comparison sets). A link is a
// tenant-scoped USER assertion that two products (each at its own merchant under per-merchant
// identity, 09/02) are interchangeable. Recorded implicitly from suggestion-chip taps on the trend
// report; there is no managed set. The table is RLS-enabled, so tenant context MUST be set before
// any call (invariant #1). One canonical row per unordered pair (product_a_id < product_b_id); the
// service canonicalizes ordering, so callers pass products in any order.

export type ProductLinkStatus = 'ACCEPTED' | 'DISMISSED';

// A directional link from a requested product (self) to its sibling (other), expanded from the
// canonical stored row. Consumed by the optimizer/crown matrix, which reasons per requested item.
export interface StoredProductLink {
  selfId: string;
  otherId: string;
  sizeEquivalent: boolean;
}

// A canonical ACCEPTED link, for the trend report's size-confirm affordance: the webapp needs to
// know which plotted product pairs are linked and whether the user already confirmed same-size.
export interface AcceptedProductLink {
  productAId: string;
  productBId: string;
  sizeEquivalent: boolean;
}

export interface IProductLinkRepository {
  // ACCEPTED links where BOTH endpoints are in the given product set — the pairs the trend report
  // can offer a size-confirm on. Tenant-scoped via RLS.
  acceptedLinksAmong(productIds: string[]): Promise<AcceptedProductLink[]>;
  // Upserts the canonical pair (a < b) to the given status; ON CONFLICT refreshes status. A repeated
  // ACCEPTED is idempotent; DISMISSED overrides a prior ACCEPT (and vice-versa) for the same pair.
  upsert(productAId: string, productBId: string, status: ProductLinkStatus): Promise<void>;
  // Sets size_equivalent on the canonical pair. Returns false when no row matched (never linked),
  // which the service maps to a 400.
  setSizeEquivalent(productAId: string, productBId: string, sizeEquivalent: boolean): Promise<boolean>;
}
