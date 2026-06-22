import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { MerchantCatalogAdapter } from '@infrastructure/adapters/data-intelligence/MerchantCatalogAdapter';
import { ProductCatalogAdapter } from '@infrastructure/adapters/data-intelligence/ProductCatalogAdapter';
import { PriceObservationStoreAdapter } from '@infrastructure/adapters/data-intelligence/PriceObservationStoreAdapter';
import { PriceTrendQueryAdapter } from '@infrastructure/adapters/data-intelligence/PriceTrendQueryAdapter';
import { OwnPurchaseHistoryQueryAdapter } from '@infrastructure/adapters/data-intelligence/OwnPurchaseHistoryQueryAdapter';
import { PriceTrendService } from '@core/services/data-intelligence/PriceTrendService';
import type { PriceObservationInput } from '@core/domain/priceObservation';

const uniqueEmbedding = (): number[] => Array.from({ length: 512 }, () => Math.random());
const DAY = 86_400_000;
const isoDay = (offsetDays: number): string =>
  new Date(Date.now() - offsetDays * DAY).toISOString().slice(0, 10);

// The store accumulates across runs, so every assertion is scoped to a region code
// minted per run — no seeding of shared/global cells, no cross-run interference.
describe('PriceTrendQueryAdapter — §6.5.1 comparison over Postgres', () => {
  let pool: Pool;
  const region = `R-${randomUUID().slice(0, 8)}`;
  const otherRegion = `R-${randomUUID().slice(0, 8)}`;
  let productId: string;
  let freshMerchantId: string; // clears k≥3, recent — served & fresh
  let sparseMerchantId: string; // only 2 observations — suppressed by the gate
  let staleMerchantId: string; // clears k≥3 but last seen 90 days ago — served & stale

  const emit = (rows: PriceObservationInput[]) => new PriceObservationStoreAdapter(pool).emit(rows);
  const obs = (
    merchantId: string,
    observedOn: string,
    normalizedUnitPrice: number,
    over: Partial<PriceObservationInput> = {},
  ): PriceObservationInput => ({
    productId, merchantId, countryCode: 'NL', regionCode: region, observedOn,
    packPrice: normalizedUnitPrice, normalizedUnitPrice, baseUnit: 'L', currency: 'EUR',
    wasDiscounted: false, quarantined: false, contributorTrustAtWrite: 50, ...over,
  });

  beforeAll(async () => {
    pool = new Pool({ host: 'localhost', port: 5432, database: 'wobblio_local', user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 4 });

    const merchants = new MerchantCatalogAdapter(pool);
    freshMerchantId = await merchants.createProvisionalMerchant('Trend Fresh Shop', 'NL', 'cat-groceries');
    sparseMerchantId = await merchants.createProvisionalMerchant('Trend Sparse Shop', 'NL', 'cat-groceries');
    staleMerchantId = await merchants.createProvisionalMerchant('Trend Stale Shop', 'NL', 'cat-groceries');
    productId = await new ProductCatalogAdapter(pool).createProvisionalProduct({
      displayName: `Trend Milk ${randomUUID().slice(0, 8)}`, brand: null, categoryId: 'cat-dairy',
      baseUnit: 'L', packSizeBaseUnits: 1, embedding: uniqueEmbedding(),
    });

    await emit([
      // Fresh cell, week W1 (today): median of 1.00/1.20/1.40 = 1.20; one promo at 0.80.
      obs(freshMerchantId, isoDay(0), 1.0),
      obs(freshMerchantId, isoDay(0), 1.2),
      obs(freshMerchantId, isoDay(0), 1.4),
      obs(freshMerchantId, isoDay(0), 0.8, { wasDiscounted: true }),
      // Fresh cell, week W2 (a week earlier): single point 1.50, no promo.
      obs(freshMerchantId, isoDay(7), 1.5),
      // Excluded from the fresh cell: quarantined, and a different region. If either
      // leaked, observationCount would exceed 5.
      obs(freshMerchantId, isoDay(0), 9.99, { quarantined: true }),
      obs(freshMerchantId, isoDay(0), 9.99, { regionCode: otherRegion }),
      // Sparse cell: 2 observations — below the k≥3 gate, must not be served.
      obs(sparseMerchantId, isoDay(0), 2.0),
      obs(sparseMerchantId, isoDay(1), 2.1),
      // Stale cell: 3 observations, all ~90 days old — served but flagged stale.
      obs(staleMerchantId, isoDay(90), 3.0),
      obs(staleMerchantId, isoDay(90), 3.2),
      obs(staleMerchantId, isoDay(90), 3.4),
    ]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM price_observation WHERE region_code = ANY($1)', [[region, otherRegion]]);
    await pool.end();
  });

  it('serves weekly medians, splits promos out, and gates on k≥3 + staleness', async () => {
    const service = new PriceTrendService(new PriceTrendQueryAdapter(pool), new OwnPurchaseHistoryQueryAdapter(pool));
    const { weeks, lines } = await service.comparison([productId], 'NL', region, true);

    expect(weeks).toBe(26);
    // Fresh + stale cells served; the 2-observation sparse cell is suppressed.
    expect(lines.map((l) => l.merchantName).sort()).toEqual(['Trend Fresh Shop', 'Trend Stale Shop']);

    const fresh = lines.find((l) => l.merchantName === 'Trend Fresh Shop')!;
    expect(fresh.observationCount).toBe(5); // quarantined + other-region rows excluded
    expect(fresh.stale).toBe(false);

    const w1 = fresh.points.find((p) => p.median !== null && Math.abs(p.median - 1.2) < 0.001)!;
    expect(w1.median).toBeCloseTo(1.2, 4);
    expect(w1.discountMedian).toBeCloseTo(0.8, 4); // promo is a distinct signal, not blended

    const w2 = fresh.points.find((p) => p.median !== null && Math.abs(p.median - 1.5) < 0.001)!;
    expect(w2.median).toBeCloseTo(1.5, 4);
    expect(w2.discountMedian).toBeNull();

    const stale = lines.find((l) => l.merchantName === 'Trend Stale Shop')!;
    expect(stale.stale).toBe(true);
    expect(stale.staleDays).toBeGreaterThanOrEqual(89);
  });

  it('suppresses every cell when no product clears the gate in the region', async () => {
    const service = new PriceTrendService(new PriceTrendQueryAdapter(pool), new OwnPurchaseHistoryQueryAdapter(pool));
    const { lines } = await service.comparison([randomUUID()], 'NL', region, true);
    expect(lines).toEqual([]);
  });
});
