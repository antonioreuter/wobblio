import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { FetchDailyFxRatesService } from '@core/services/fx/FetchDailyFxRatesService';
import type { IEcbRateSource } from '@core/ports/fx/IEcbRateSource';
import type { IFxRateRepository } from '@core/ports/fx/IFxRateRepository';

describe('FetchDailyFxRatesService', () => {
  let ecb: MockedObject<IEcbRateSource>;
  let fxRates: MockedObject<IFxRateRepository>;
  let sut: FetchDailyFxRatesService;

  const daily = { date: '2026-06-30', rows: [{ quote: 'USD', rate: 1.0873 }, { quote: 'GBP', rate: 0.85 }] };

  beforeEach(() => {
    ecb = { fetchDaily: vi.fn() };
    fxRates = { upsertDaily: vi.fn(), latestOnOrBefore: vi.fn() };
    sut = new FetchDailyFxRatesService(ecb, fxRates);
  });

  it('fetches once and upserts on the first success', async () => {
    ecb.fetchDaily.mockResolvedValue(daily);
    fxRates.upsertDaily.mockResolvedValue(2);

    const result = await sut.run();

    expect(result).toEqual({ upserted: 2, usedFallback: false });
    expect(ecb.fetchDaily).toHaveBeenCalledTimes(1);
    expect(fxRates.upsertDaily).toHaveBeenCalledWith('2026-06-30', 'EUR', daily.rows);
  });

  it('retries the fetch and succeeds within 3 attempts', async () => {
    ecb.fetchDaily
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(daily);
    fxRates.upsertDaily.mockResolvedValue(2);

    const result = await sut.run();

    expect(result.usedFallback).toBe(false);
    expect(ecb.fetchDaily).toHaveBeenCalledTimes(2);
  });

  it('signals fallback after 3 failed attempts and never writes', async () => {
    ecb.fetchDaily.mockRejectedValue(new Error('down'));

    const result = await sut.run();

    expect(result).toEqual({ upserted: 0, usedFallback: true });
    expect(ecb.fetchDaily).toHaveBeenCalledTimes(3);
    expect(fxRates.upsertDaily).not.toHaveBeenCalled();
  });
});
