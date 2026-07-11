import type { PriceMatrix } from '@core/domain/routeOptimizer';

// Builds the product × candidate-merchant price matrix for the user's region.
// Only serving cells (k≥3 observations) are returned; userAverages fills gaps.
// Scoped to a single country + currency so the matrix and the user's own averages
// never mix currencies (a country-based list is priced in that country's currency).
export interface IPriceMatrix {
  build(
    productIds: string[],
    regionCode: string,
    countryCode: string,
    currency: string,
  ): Promise<PriceMatrix>;
}
