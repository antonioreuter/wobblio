import type { MatchedBasketItem } from '../../domain/personalInflation';

// The matched basket for the caller's personal inflation number, read from the RLS-scoped
// invoice_line store (NOT the de-identified price_observation store — this is the user's own price
// history). Tenant context MUST be set before the call or the RLS policies return zero rows. Only
// products bought in BOTH periods are returned; regular (non-discount, non-deposit) lines only, so
// the comparison is like-for-like shelf price.

export interface PersonalInflationInput {
  /// Length in days of each compared period. Current = [today-windowDays, today];
  /// prior = [today-2·windowDays, today-windowDays].
  windowDays: number;
  /// The caller's home currency. Receipts in any other currency are excluded so a matched
  /// basket never blends, say, BRL and EUR prices into one median. Null (unresolved) omits
  /// the filter — the caller then accepts a possibly-mixed basket rather than an empty one.
  homeCurrency: string | null;
}

export interface IPersonalInflationQuery {
  matchedBasket(input: PersonalInflationInput): Promise<MatchedBasketItem[]>;
}
