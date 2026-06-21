import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import {
  PriceTrendService,
  TREND_K_MIN,
  TREND_WINDOW_WEEKS,
} from '@core/services/data-intelligence/PriceTrendService';
import type { IPriceTrendQuery, PriceTrendLine } from '@core/ports/data-intelligence/IPriceTrendQuery';
import { InvalidTrendQueryError } from '@core/domain/errors';

const line = (over: Partial<PriceTrendLine> = {}): PriceTrendLine => ({
  productId: 'milk',
  merchantId: 'm1',
  merchantName: 'Albert Heijn',
  points: [{ weekStart: '2026-06-15', median: 1.29, discountMedian: null }],
  observationCount: 5,
  lastObservedOn: '2026-06-18',
  ...over,
});

const NOW = new Date('2026-06-21T10:00:00Z');

describe('PriceTrendService', () => {
  let trends: MockedObject<IPriceTrendQuery>;
  let sut: PriceTrendService;

  beforeEach(() => {
    trends = { comparison: vi.fn().mockResolvedValue([line()]) };
    sut = new PriceTrendService(trends, () => NOW);
  });

  it('rejects an empty product selection', async () => {
    await expect(sut.comparison([], 'NL', 'NL-NB')).rejects.toBeInstanceOf(InvalidTrendQueryError);
    expect(trends.comparison).not.toHaveBeenCalled();
  });

  it('rejects more than three products', async () => {
    await expect(sut.comparison(['a', 'b', 'c', 'd'], 'NL', 'NL-NB')).rejects.toBeInstanceOf(
      InvalidTrendQueryError,
    );
  });

  it('rejects a missing country or region', async () => {
    await expect(sut.comparison(['milk'], '', 'NL-NB')).rejects.toBeInstanceOf(InvalidTrendQueryError);
    await expect(sut.comparison(['milk'], 'NL', '  ')).rejects.toBeInstanceOf(InvalidTrendQueryError);
  });

  it('dedupes/trims products and forwards the §6.5 window and k threshold', async () => {
    await sut.comparison([' milk ', 'milk', 'coffee'], 'NL', 'NL-NB');
    expect(trends.comparison).toHaveBeenCalledWith({
      productIds: ['milk', 'coffee'],
      countryCode: 'NL',
      regionCode: 'NL-NB',
      weeks: TREND_WINDOW_WEEKS,
      kMin: TREND_K_MIN,
    });
  });

  it('marks a line stale when its last observation is older than 60 days', async () => {
    trends.comparison.mockResolvedValue([line({ lastObservedOn: '2026-04-10' })]);
    const { lines } = await sut.comparison(['milk'], 'NL', 'NL-NB');
    expect(lines[0].stale).toBe(true);
    expect(lines[0].staleDays).toBe(72);
  });

  it('keeps a recently observed line fresh', async () => {
    const { lines } = await sut.comparison(['milk'], 'NL', 'NL-NB');
    expect(lines[0].stale).toBe(false);
    expect(lines[0].staleDays).toBe(3);
  });

  it('defaults the clock to the wall time when none is injected', async () => {
    const today = new Date().toISOString().slice(0, 10);
    trends.comparison.mockResolvedValue([line({ lastObservedOn: today })]);
    const service = new PriceTrendService(trends);
    const { lines } = await service.comparison(['milk'], 'NL', 'NL-NB');
    expect(lines[0].staleDays).toBe(0);
    expect(lines[0].stale).toBe(false);
  });
});
