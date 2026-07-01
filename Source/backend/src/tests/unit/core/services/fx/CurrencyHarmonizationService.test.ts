import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { CurrencyHarmonizationService } from '@core/services/fx/CurrencyHarmonizationService';
import type { IFxRateRepository } from '@core/ports/fx/IFxRateRepository';

describe('CurrencyHarmonizationService', () => {
  let fxRates: MockedObject<IFxRateRepository>;
  let sut: CurrencyHarmonizationService;

  beforeEach(() => {
    fxRates = { upsertDaily: vi.fn(), latestOnOrBefore: vi.fn() };
    sut = new CurrencyHarmonizationService(fxRates);
  });

  it('is identity when the invoice is already in the home currency', async () => {
    const result = await sut.harmonize(12.345, 'EUR', 'EUR', '2026-06-30');
    expect(result).toEqual({ totalHomeCurrency: 12.35, fxRateUsed: 1 });
    expect(fxRates.latestOnOrBefore).not.toHaveBeenCalled();
  });

  it('is case-insensitive on the identity check', async () => {
    const result = await sut.harmonize(10, 'usd', 'USD', '2026-06-30');
    expect(result).toEqual({ totalHomeCurrency: 10, fxRateUsed: 1 });
  });

  it('converts a foreign currency into a EUR home using the single EUR leg', async () => {
    // 1 EUR = 1.0873 USD → 108.73 USD = 100.00 EUR
    fxRates.latestOnOrBefore.mockImplementation(async (quote) => (quote === 'USD' ? 1.0873 : null));
    const result = await sut.harmonize(108.73, 'USD', 'EUR', '2026-06-30');
    expect(result.fxRateUsed).toBeCloseTo(1 / 1.0873, 8);
    expect(result.totalHomeCurrency).toBe(100);
  });

  it('crosses two non-EUR currencies via EUR', async () => {
    // EUR→USD = 1.0873, EUR→GBP = 0.85 → USD→GBP = 0.85 / 1.0873
    fxRates.latestOnOrBefore.mockImplementation(async (quote) =>
      quote === 'USD' ? 1.0873 : quote === 'GBP' ? 0.85 : null,
    );
    const result = await sut.harmonize(100, 'USD', 'GBP', '2026-06-30');
    expect(result.fxRateUsed).toBeCloseTo(0.85 / 1.0873, 8);
    expect(result.totalHomeCurrency).toBe(Number((100 * (0.85 / 1.0873)).toFixed(2)));
  });

  it('returns nulls (never throws) when a required rate is missing', async () => {
    fxRates.latestOnOrBefore.mockResolvedValue(null);
    const result = await sut.harmonize(100, 'ZWL', 'EUR', '2026-06-30');
    expect(result).toEqual({ totalHomeCurrency: null, fxRateUsed: null });
  });

  it('returns nulls when the source EUR rate is zero (guards division by zero)', async () => {
    fxRates.latestOnOrBefore.mockImplementation(async (quote) => (quote === 'USD' ? 0 : 0.85));
    const result = await sut.harmonize(100, 'USD', 'GBP', '2026-06-30');
    expect(result).toEqual({ totalHomeCurrency: null, fxRateUsed: null });
  });
});
