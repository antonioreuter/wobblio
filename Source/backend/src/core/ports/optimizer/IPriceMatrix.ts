import type { PriceMatrix, OwnHistoryBasketTotal } from '@core/domain/routeOptimizer';
import type { ComparabilityReason } from '@core/domain/comparability';

export interface PriceMatrixResult {
  matrix: PriceMatrix;
  // Per requested product: why its comparison-set siblings were (or weren't) folded into its row
  // (09/05). Lets OptimizerService annotate each line and pick the degradation rung.
  reasons: Record<string, ComparabilityReason>;
}

// Builds the product × candidate-merchant price matrix for the user's region, folding in the
// caller's comparison sets under the comparability + ambiguity rules (09/05). Only serving cells
// (k≥3 observations) are returned; userAverages fills gaps. Scoped to a single country + currency
// so the matrix and the user's own averages never mix currencies.
export interface IPriceMatrix {
  build(
    productIds: string[],
    regionCode: string,
    countryCode: string,
    currency: string,
  ): Promise<PriceMatrixResult>;
  // 09/05 zero-link fallback: the tenant's own-history whole-basket total per merchant they've
  // shopped at (RLS-scoped, single currency). Returned only to power the degraded view.
  ownHistoryBasket(productIds: string[], currency: string): Promise<OwnHistoryBasketTotal[]>;
}
