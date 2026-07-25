import type { IPriceMatrix, PriceMatrixResult } from '@core/ports/optimizer/IPriceMatrix';
import type { MerchantRef, PriceCell } from '@core/domain/routeOptimizer';
import type { ComparabilityReason } from '@core/domain/comparability';

const MOCK_MERCHANTS: MerchantRef[] = [
  { id: '00000000-0000-0000-0000-0000000000a1', name: 'Albert Heijn' },
  { id: '00000000-0000-0000-0000-0000000000b2', name: 'Jumbo' },
  { id: '00000000-0000-0000-0000-0000000000c3', name: 'Lidl' },
];

// Local stand-in so the optimizer endpoint is exercisable without seeded price
// data. Each product's cheapest store rotates across merchants, so multi-product
// lists produce a genuine split. AWS uses PriceMatrixAdapter (see factory).
export class MockPriceMatrixAdapter implements IPriceMatrix {
  async build(productIds: string[]): Promise<PriceMatrixResult> {
    const today = new Date().toISOString().slice(0, 10);
    const cells: PriceCell[] = [];
    const reasons: Record<string, ComparabilityReason> = {};

    productIds.forEach((productId, index) => {
      const base = 2 + (index % 5) * 0.75;
      const cheapest = index % MOCK_MERCHANTS.length;
      MOCK_MERCHANTS.forEach((merchant, m) => {
        cells.push({
          productId,
          merchantId: merchant.id,
          price: Number((m === cheapest ? base * 0.7 : base).toFixed(2)),
          observationCount: 8,
          lastObservedOn: today,
        });
      });
      // Local stand-in has every product priced at all three merchants (no product-link gating).
      reasons[productId] = 'comparable';
    });

    return { matrix: { merchants: MOCK_MERCHANTS, cells, userAverages: {} }, reasons };
  }

  // Local stand-in: no own history, so the zero-link fallback has nothing to show.
  async ownHistoryBasket(): Promise<[]> {
    return [];
  }
}
