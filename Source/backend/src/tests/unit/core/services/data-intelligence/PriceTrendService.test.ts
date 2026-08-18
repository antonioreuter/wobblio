import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import {
  PriceTrendService,
  TREND_K_MIN,
  TREND_WINDOW_WEEKS,
} from '@core/services/data-intelligence/PriceTrendService';
import type { IPriceTrendQuery, PriceTrendLine } from '@core/ports/data-intelligence/IPriceTrendQuery';
import type {
  IOwnPurchaseHistoryQuery,
  OwnPurchaseLine,
} from '@core/ports/data-intelligence/IOwnPurchaseHistoryQuery';
import { InvalidTrendQueryError } from '@core/domain/errors';

const noSize = { sizeText: null, sizeSource: null };

const line = (over: Partial<PriceTrendLine> = {}): PriceTrendLine => ({
  productId: 'milk',
  merchantId: 'm1',
  merchantName: 'Albert Heijn',
  points: [{ weekStart: '2026-06-15', median: 1.29, discountMedian: null }],
  observationCount: 5,
  lastObservedOn: '2026-06-18',
  size: noSize,
  ambiguous: false,
  ...over,
});

const ownLine = (over: Partial<OwnPurchaseLine> = {}): OwnPurchaseLine => ({
  productId: 'milk',
  points: [{ weekStart: '2026-06-15', median: 1.19, discountMedian: null }],
  purchaseCount: 1,
  lastPurchasedOn: '2026-06-17',
  priorPurchaseExists: false,
  lastPrice: 1.19,
  previousPrice: null,
  size: noSize,
  ...over,
});

const NOW = new Date('2026-06-21T10:00:00Z');

describe('PriceTrendService', () => {
  let trends: MockedObject<IPriceTrendQuery>;
  let ownHistory: MockedObject<IOwnPurchaseHistoryQuery>;
  let sut: PriceTrendService;

  beforeEach(() => {
    trends = {
      comparison: vi.fn().mockResolvedValue([line()]),
      modalCurrency: vi.fn().mockResolvedValue(null),
      regionMerchantCount: vi.fn().mockResolvedValue(2),
      productDiagnostics: vi.fn().mockResolvedValue([]),
    };
    ownHistory = {
      history: vi.fn().mockResolvedValue([ownLine()]),
      modalCurrency: vi.fn().mockResolvedValue(null),
    };
    sut = new PriceTrendService(trends, ownHistory, () => NOW);
  });

  it('rejects an empty product selection', async () => {
    await expect(sut.comparison([], 'NL', 'NL-NB', true)).rejects.toBeInstanceOf(InvalidTrendQueryError);
    expect(trends.comparison).not.toHaveBeenCalled();
    expect(ownHistory.history).not.toHaveBeenCalled();
  });

  it('rejects more than three products', async () => {
    await expect(sut.comparison(['a', 'b', 'c', 'd'], 'NL', 'NL-NB', true)).rejects.toBeInstanceOf(
      InvalidTrendQueryError,
    );
  });

  it('rejects a missing country or region', async () => {
    await expect(sut.comparison(['milk'], '', 'NL-NB', true)).rejects.toBeInstanceOf(InvalidTrendQueryError);
    await expect(sut.comparison(['milk'], 'NL', '  ', true)).rejects.toBeInstanceOf(InvalidTrendQueryError);
  });

  it('dedupes/trims products and forwards the §6.5 window, k threshold, and view currency', async () => {
    await sut.comparison([' milk ', 'milk', 'coffee'], 'NL', 'NL-NB', true);
    expect(trends.comparison).toHaveBeenCalledWith({
      productIds: ['milk', 'coffee'],
      countryCode: 'NL',
      regionCode: 'NL-NB',
      weeks: TREND_WINDOW_WEEKS,
      kMin: TREND_K_MIN,
      currency: 'EUR',
    });
  });

  it('always queries own history with the deduped products, region, and view currency', async () => {
    await sut.comparison([' milk ', 'milk', 'coffee'], 'NL', 'NL-NB', true);
    expect(ownHistory.history).toHaveBeenCalledWith({
      productIds: ['milk', 'coffee'],
      countryCode: 'NL',
      regionCode: 'NL-NB',
      weeks: TREND_WINDOW_WEEKS,
      currency: 'EUR',
    });
  });

  it('stamps the country-derived currency on the response without a modal lookup', async () => {
    const result = await sut.comparison(['milk'], 'GB', 'GB-ENG', true);
    expect(result.currency).toBe('GBP');
    expect(trends.modalCurrency).not.toHaveBeenCalled();
  });

  it('prefers the caller\'s own-receipt modal currency over the public one for an unmapped country', async () => {
    // JP is not in the countryCurrency map, so the service resolves the currency by modal lookup.
    ownHistory.modalCurrency.mockResolvedValue('JPY'); // the user's own receipts are JPY
    trends.modalCurrency.mockResolvedValue('USD'); // the public store's modal differs
    const result = await sut.comparison(['milk'], 'JP', 'JP-13', true);
    expect(result.currency).toBe('JPY');
    // the public modal is not consulted once the own modal resolves — own history is never hidden.
    expect(trends.modalCurrency).not.toHaveBeenCalled();
    expect(ownHistory.history).toHaveBeenCalledWith(expect.objectContaining({ currency: 'JPY' }));
    expect(trends.comparison).toHaveBeenCalledWith(expect.objectContaining({ currency: 'JPY' }));
  });

  it('falls back to the public region modal currency when the caller has no own receipts here', async () => {
    ownHistory.modalCurrency.mockResolvedValue(null);
    trends.modalCurrency.mockResolvedValue('JPY');
    const result = await sut.comparison(['milk'], 'JP', 'JP-13', true);
    expect(ownHistory.modalCurrency).toHaveBeenCalledWith({
      productIds: ['milk'],
      countryCode: 'JP',
      regionCode: 'JP-13',
      weeks: TREND_WINDOW_WEEKS,
    });
    expect(result.currency).toBe('JPY');
    expect(ownHistory.history).toHaveBeenCalledWith(expect.objectContaining({ currency: 'JPY' }));
  });

  it('serves own history but no market lines when the market trend is excluded (STANDARD)', async () => {
    const result = await sut.comparison(['milk'], 'NL', 'NL-NB', false);
    expect(trends.comparison).not.toHaveBeenCalled();
    expect(result.lines).toEqual([]);
    expect(result.ownHistory).toEqual([{ ...ownLine(), stale: false, staleDays: 4 }]);
    // Cold-start count is a market signal — 0 for STANDARD (no market view), no query fired.
    expect(trends.regionMerchantCount).not.toHaveBeenCalled();
    expect(result.regionMerchantCount).toBe(0);
  });

  it('stamps the pre-gate merchant count on the response for the market view', async () => {
    trends.comparison.mockResolvedValue([]); // below quorum — the motivator still needs the count
    trends.regionMerchantCount.mockResolvedValue(2);
    const result = await sut.comparison(['milk'], 'NL', 'NL-NB', true);
    expect(result.regionMerchantCount).toBe(2);
  });

  it('returns own history even when the market trend is empty (below quorum)', async () => {
    trends.comparison.mockResolvedValue([]);
    const result = await sut.comparison(['milk'], 'NL', 'NL-NB', true);
    expect(result.lines).toEqual([]);
    expect(result.ownHistory).toEqual([{ ...ownLine(), stale: false, staleDays: 4 }]);
  });

  it('marks a line stale when its last observation is older than 60 days', async () => {
    trends.comparison.mockResolvedValue([line({ lastObservedOn: '2026-04-10' })]);
    const { lines } = await sut.comparison(['milk'], 'NL', 'NL-NB', true);
    expect(lines[0].stale).toBe(true);
    expect(lines[0].staleDays).toBe(72);
  });

  it('keeps a recently observed line fresh', async () => {
    const { lines } = await sut.comparison(['milk'], 'NL', 'NL-NB', true);
    expect(lines[0].stale).toBe(false);
    expect(lines[0].staleDays).toBe(3);
  });

  // §6.5.2 freshness honesty applies to the caller's own series too — it used to be served
  // undecorated, so a product last bought five months ago never greyed.
  it('marks an own series stale when the last purchase is older than 60 days', async () => {
    ownHistory.history.mockResolvedValue([ownLine({ lastPurchasedOn: '2026-04-10' })]);
    const { ownHistory: served } = await sut.comparison(['milk'], 'NL', 'NL-NB', true);
    expect(served[0].stale).toBe(true);
    expect(served[0].staleDays).toBe(72);
  });

  it('keeps a recently bought own series fresh', async () => {
    const { ownHistory: served } = await sut.comparison(['milk'], 'NL', 'NL-NB', true);
    expect(served[0].stale).toBe(false);
    expect(served[0].staleDays).toBe(4);
  });

  it('passes the prior-purchase flag through untouched', async () => {
    ownHistory.history.mockResolvedValue([ownLine({ priorPurchaseExists: true })]);
    const { ownHistory: served } = await sut.comparison(['milk'], 'NL', 'NL-NB', true);
    expect(served[0].priorPurchaseExists).toBe(true);
  });

  it('defaults the clock to the wall time when none is injected', async () => {
    const today = new Date().toISOString().slice(0, 10);
    trends.comparison.mockResolvedValue([line({ lastObservedOn: today })]);
    const service = new PriceTrendService(trends, ownHistory);
    const { lines } = await service.comparison(['milk'], 'NL', 'NL-NB', true);
    expect(lines[0].staleDays).toBe(0);
    expect(lines[0].stale).toBe(false);
  });

  describe('diagnostics (fix 10)', () => {
    const stat = (over: Partial<{ productId: string; inWindowCurrencyCount: number; otherCurrencyInWindowCount: number; maxCellCount: number; merchantCount: number }> = {}) => ({
      productId: 'milk', inWindowCurrencyCount: 0, otherCurrencyInWindowCount: 0, maxCellCount: 0, merchantCount: 0, ...over,
    });

    it('marks a served product SERVED in both modes without a stats query', async () => {
      const { diagnostics } = await sut.comparison(['milk'], 'NL', 'NL-NB', true);
      expect(diagnostics).toEqual([{ productId: 'milk', market: 'SERVED', own: 'SERVED' }]);
      expect(trends.productDiagnostics).not.toHaveBeenCalled();
    });

    it('marks the market side PREMIUM_REQUIRED for a STANDARD caller (no stats query)', async () => {
      const { diagnostics } = await sut.comparison(['milk'], 'NL', 'NL-NB', false);
      expect(diagnostics[0].market).toBe('PREMIUM_REQUIRED');
      expect(trends.productDiagnostics).not.toHaveBeenCalled();
    });

    it('reports NO_OBSERVATIONS_IN_REGION when an unserved product has no region stats', async () => {
      trends.comparison.mockResolvedValue([]);
      trends.productDiagnostics.mockResolvedValue([]);
      const { diagnostics } = await sut.comparison(['milk'], 'NL', 'NL-NB', true);
      expect(diagnostics[0].market).toBe('NO_OBSERVATIONS_IN_REGION');
    });

    it('reports OUT_OF_WINDOW when region rows exist but none in the window', async () => {
      trends.comparison.mockResolvedValue([]);
      trends.productDiagnostics.mockResolvedValue([stat({ inWindowCurrencyCount: 0, otherCurrencyInWindowCount: 0 })]);
      const { diagnostics } = await sut.comparison(['milk'], 'NL', 'NL-NB', true);
      expect(diagnostics[0].market).toBe('OUT_OF_WINDOW');
    });

    it('reports CURRENCY_MISMATCH when in-window rows exist only in another currency', async () => {
      trends.comparison.mockResolvedValue([]);
      trends.productDiagnostics.mockResolvedValue([stat({ inWindowCurrencyCount: 0, otherCurrencyInWindowCount: 4 })]);
      const { diagnostics } = await sut.comparison(['milk'], 'NL', 'NL-NB', true);
      expect(diagnostics[0].market).toBe('CURRENCY_MISMATCH');
    });

    it('reports BELOW_QUORUM with how close it is when in-window rows exist but no cell cleared k', async () => {
      trends.comparison.mockResolvedValue([]);
      trends.productDiagnostics.mockResolvedValue([stat({ inWindowCurrencyCount: 2, maxCellCount: 2, merchantCount: 1 })]);
      const { diagnostics } = await sut.comparison(['milk'], 'NL', 'NL-NB', true);
      expect(diagnostics[0].market).toEqual({ kind: 'BELOW_QUORUM', merchantCount: 1, maxObservations: 2 });
    });

    it('reports NO_PURCHASES_IN_REGION on the own side when the product is absent from own history', async () => {
      ownHistory.history.mockResolvedValue([]);
      const { diagnostics } = await sut.comparison(['milk'], 'NL', 'NL-NB', true);
      expect(diagnostics[0].own).toBe('NO_PURCHASES_IN_REGION');
    });
  });
});
