import type { BaseUnit } from './unitSize';

// 09/05 — THE COMPARABILITY RULE. Two linked offers (an item's own product and a comparison-set
// sibling) may be ranked together ("best price", optimizer matrix) only when they are comparable
// AND unambiguous. No per-unit math ever: pack equality or the user's explicit "same size/pack"
// assertion are the only bases for ranking. Non-comparable or ambiguous offers are displayed,
// never ranked.

export interface OfferSize {
  packSize: number | null; // pack size in base units; null = size unknown (never inferred)
  baseUnit: BaseUnit | null;
}

export interface Offer {
  size: OfferSize;
  // The user confirmed this sibling is the same size/pack as the item (membership size_equivalent).
  // Ignored for the item's own offer (pass false).
  sizeEquivalent: boolean;
  // The (product, merchant) cell is price-ambiguous (bimodal same-name history) — never rankable.
  ambiguous: boolean;
}

// Why a sibling offer was (or wasn't) rankable against the item's own offer. `comparable` is the
// only reason that enters the crown / optimizer matrix.
export type ComparabilityReason = 'comparable' | 'watch_only' | 'ambiguous' | 'no_link';

function sizesKnownAndEqual(a: OfferSize, b: OfferSize): boolean {
  return (
    a.packSize !== null && b.packSize !== null &&
    a.baseUnit !== null && b.baseUnit !== null &&
    a.baseUnit === b.baseUnit && a.packSize === b.packSize
  );
}

// Classify a sibling offer relative to the item's own offer. Ambiguity (on either side) wins — an
// ambiguous cell is never rankable even when sizes match or the user asserted equivalence.
export function classifyComparability(self: Offer, other: Offer): ComparabilityReason {
  if (self.ambiguous || other.ambiguous) return 'ambiguous';
  if (other.sizeEquivalent) return 'comparable';
  if (sizesKnownAndEqual(self.size, other.size)) return 'comparable';
  return 'watch_only';
}
