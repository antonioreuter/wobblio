import type { IFxRateRepository } from '../../ports/fx/IFxRateRepository';
import { roundTo } from '../../domain/unitSize';

export interface HarmonizedTotal {
  totalHomeCurrency: number | null;
  fxRateUsed: number | null;
}

// Converts an invoice total into the user's home currency using the transaction-date ECB rate
// (§11 FX). ECB is EUR-base only, so a non-EUR→non-EUR pair is crossed via EUR. The effective
// from→home rate is preserved in fx_rate_used so historical figures stay honest as rates move.
export class CurrencyHarmonizationService {
  constructor(private readonly fxRates: IFxRateRepository) {}

  async harmonize(
    amount: number,
    fromCurrency: string,
    homeCurrency: string,
    onDate: string,
  ): Promise<HarmonizedTotal> {
    const from = fromCurrency.toUpperCase();
    const home = homeCurrency.toUpperCase();
    if (from === home) return { totalHomeCurrency: roundTo(amount, 2), fxRateUsed: 1 };

    const eurToFrom = await this.eurRate(from, onDate);
    const eurToHome = await this.eurRate(home, onDate);
    // Ingestion must never fail on a missing rate — leave the columns null and let reports
    // fall back to the source amount rather than blocking the invoice.
    if (eurToFrom === null || eurToHome === null || eurToFrom === 0) {
      return { totalHomeCurrency: null, fxRateUsed: null };
    }

    const fxRateUsed = eurToHome / eurToFrom;
    return { totalHomeCurrency: roundTo(amount * fxRateUsed, 2), fxRateUsed };
  }

  private async eurRate(currency: string, onDate: string): Promise<number | null> {
    if (currency === 'EUR') return 1;
    return this.fxRates.latestOnOrBefore(currency, onDate);
  }
}
