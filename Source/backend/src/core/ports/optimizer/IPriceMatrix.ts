import type { PriceMatrix } from '@core/domain/routeOptimizer';

// Builds the product × candidate-merchant price matrix for the user's region.
// Only serving cells (k≥3 observations) are returned; userAverages fills gaps.
export interface IPriceMatrix {
  build(productIds: string[], regionCode: string): Promise<PriceMatrix>;
}
