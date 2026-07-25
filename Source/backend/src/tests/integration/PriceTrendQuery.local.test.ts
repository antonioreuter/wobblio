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
    packPrice: number,
    over: Partial<PriceObservationInput> = {},
  ): PriceObservationInput => ({
    productId, merchantId, countryCode: 'NL', regionCode: region, observedOn,
    packPrice, currency: 'EUR',
    wasDiscounted: false, quality: 'AUTO', quarantined: false, contributorTrustAtWrite: 50, ...over,
  });

  beforeAll(async () => {
    pool = new Pool({ host: 'localhost', port: 5432, database: 'wobblio_local', user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 4 });

    const merchants = new MerchantCatalogAdapter(pool);
    freshMerchantId = await merchants.createProvisionalMerchant('Trend Fresh Shop', 'NL', 'cat-groceries');
    sparseMerchantId = await merchants.createProvisionalMerchant('Trend Sparse Shop', 'NL', 'cat-groceries');
    staleMerchantId = await merchants.createProvisionalMerchant('Trend Stale Shop', 'NL', 'cat-groceries');
    productId = await new ProductCatalogAdapter(pool).createProvisionalProduct({
      displayName: `Trend Milk ${randomUUID().slice(0, 8)}`, brand: null, categoryId: 'cat-dairy',
      merchantId: freshMerchantId, baseUnit: 'L', packSizeBaseUnits: 1, embedding: uniqueEmbedding(),
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

  it('filters to the view currency so a GBP row never blends into a EUR (NL) median', async () => {
    const mixedMerchantId = await new MerchantCatalogAdapter(pool).createProvisionalMerchant(
      'Trend Mixed Shop', 'NL', 'cat-groceries',
    );
    await emit([
      obs(mixedMerchantId, isoDay(0), 1.0),
      obs(mixedMerchantId, isoDay(0), 1.0),
      obs(mixedMerchantId, isoDay(0), 1.0),
      // Foreign-currency rows in the same region/week — must be excluded, not blended.
      obs(mixedMerchantId, isoDay(0), 9.99, { currency: 'GBP' }),
      obs(mixedMerchantId, isoDay(0), 9.99, { currency: 'GBP' }),
    ]);

    const service = new PriceTrendService(new PriceTrendQueryAdapter(pool), new OwnPurchaseHistoryQueryAdapter(pool));
    const { currency, lines } = await service.comparison([productId], 'NL', region, true);

    expect(currency).toBe('EUR');
    const mixed = lines.find((l) => l.merchantName === 'Trend Mixed Shop')!;
    expect(mixed.observationCount).toBe(3); // only the EUR rows
    const week = mixed.points.find((p) => p.median !== null)!;
    expect(week.median).toBeCloseTo(1.0, 4); // not pulled up toward 9.99
  });

  it('counts tracked merchants pre-gate for the cold-start motivator', async () => {
    // Two merchants each with a single observation of the product — below k≥3, so no cell clears,
    // but the motivator must still report "2 stores tracked in your area".
    const coldRegion = `R-${randomUUID().slice(0, 8)}`;
    const shopA = await new MerchantCatalogAdapter(pool).createProvisionalMerchant('Cold Shop A', 'NL', 'cat-groceries');
    const shopB = await new MerchantCatalogAdapter(pool).createProvisionalMerchant('Cold Shop B', 'NL', 'cat-groceries');
    await emit([
      obs(shopA, isoDay(0), 1.0, { regionCode: coldRegion }),
      obs(shopB, isoDay(0), 1.1, { regionCode: coldRegion }),
    ]);
    try {
      const adapter = new PriceTrendQueryAdapter(pool);
      const count = await adapter.regionMerchantCount({
        productIds: [productId], countryCode: 'NL', regionCode: coldRegion, weeks: 26, kMin: 3, currency: 'EUR',
      });
      expect(count).toBe(2);

      // And it flows onto the service response even though no cell clears the gate.
      const service = new PriceTrendService(adapter, new OwnPurchaseHistoryQueryAdapter(pool));
      const { lines, regionMerchantCount } = await service.comparison([productId], 'NL', coldRegion, true);
      expect(lines).toEqual([]);
      expect(regionMerchantCount).toBe(2);
    } finally {
      await pool.query('DELETE FROM price_observation WHERE region_code = $1', [coldRegion]);
    }
  });

  it('reports per-product region stats for the empty-chart diagnostics (fix 10)', async () => {
    // Isolated region: one merchant with 2 EUR rows (below k≥3) and 2 GBP rows in the window.
    const diagRegion = `R-${randomUUID().slice(0, 8)}`;
    const shop = await new MerchantCatalogAdapter(pool).createProvisionalMerchant('Diag Shop', 'NL', 'cat-groceries');
    await emit([
      obs(shop, isoDay(0), 1.0, { regionCode: diagRegion }),
      obs(shop, isoDay(1), 1.1, { regionCode: diagRegion }),
      obs(shop, isoDay(0), 9.99, { regionCode: diagRegion, currency: 'GBP' }),
      obs(shop, isoDay(1), 9.99, { regionCode: diagRegion, currency: 'GBP' }),
      // Outside the window — must not count toward in-window totals.
      obs(shop, isoDay(300), 1.0, { regionCode: diagRegion }),
    ]);
    try {
      const stats = await new PriceTrendQueryAdapter(pool).productDiagnostics({
        productIds: [productId], countryCode: 'NL', regionCode: diagRegion, weeks: 26, kMin: 3, currency: 'EUR',
      });
      const stat = stats.find((s) => s.productId === productId)!;
      expect(stat.inWindowCurrencyCount).toBe(2); // the 2 in-window EUR rows
      expect(stat.otherCurrencyInWindowCount).toBe(2); // the 2 in-window GBP rows
      expect(stat.maxCellCount).toBe(2); // best single merchant cell — one short of k≥3
      expect(stat.merchantCount).toBe(1);
    } finally {
      await pool.query('DELETE FROM price_observation WHERE region_code = $1', [diagRegion]);
    }
  });

  it('falls back to the region modal currency for an unmapped country', async () => {
    // CA is a seeded country but intentionally absent from the countryCurrency map, so the
    // service must resolve the view currency by modal lookup rather than the country map.
    const caMerchantId = await new MerchantCatalogAdapter(pool).createProvisionalMerchant(
      'Trend CA Shop', 'CA', 'cat-groceries',
    );
    // Unmapped country (CA): the modal of the region's own rows (CAD, 3 of them) wins over 1 EUR.
    await emit([
      obs(caMerchantId, isoDay(0), 5.0, { countryCode: 'CA', regionCode: otherRegion, currency: 'CAD' }),
      obs(caMerchantId, isoDay(0), 5.2, { countryCode: 'CA', regionCode: otherRegion, currency: 'CAD' }),
      obs(caMerchantId, isoDay(0), 5.4, { countryCode: 'CA', regionCode: otherRegion, currency: 'CAD' }),
      obs(caMerchantId, isoDay(0), 1.0, { countryCode: 'CA', regionCode: otherRegion, currency: 'EUR' }),
    ]);

    const service = new PriceTrendService(new PriceTrendQueryAdapter(pool), new OwnPurchaseHistoryQueryAdapter(pool));
    const { currency, lines } = await service.comparison([productId], 'CA', otherRegion, true);

    expect(currency).toBe('CAD');
    const ca = lines.find((l) => l.merchantName === 'Trend CA Shop')!;
    expect(ca.observationCount).toBe(3); // CAD rows only; the lone EUR row excluded
  });
});
