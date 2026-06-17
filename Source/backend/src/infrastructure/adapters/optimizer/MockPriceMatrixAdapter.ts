import type { IPriceMatrix } from '@core/ports/optimizer/IPriceMatrix';
import type { PriceMatrix, MerchantRef, PriceCell } from '@core/domain/routeOptimizer';

const MOCK_MERCHANTS: MerchantRef[] = [
  { id: '00000000-0000-0000-0000-0000000000a1', name: 'Albert Heijn' },
  { id: '00000000-0000-0000-0000-0000000000b2', name: 'Jumbo' },
  { id: '00000000-0000-0000-0000-0000000000c3', name: 'Lidl' },
];

// Local stand-in so the optimizer endpoint is exercisable without seeded price
// data. Each product's cheapest store rotates across merchants, so multi-product
// lists produce a genuine split. AWS uses PriceMatrixAdapter (see factory).
export class MockPriceMatrixAdapter implements IPriceMatrix {
  async build(productIds: string[]): Promise<PriceMatrix> {
    const today = new Date().toISOString().slice(0, 10);
    const cells: PriceCell[] = [];

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
    });

    return { merchants: MOCK_MERCHANTS, cells, userAverages: {} };
  }
}
