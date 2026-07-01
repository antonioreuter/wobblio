import type { IEcbRateSource } from '../../ports/fx/IEcbRateSource';
import type { IFxRateRepository } from '../../ports/fx/IFxRateRepository';

const MAX_ATTEMPTS = 3;
const EUR = 'EUR';

export interface FxFetchResult {
  upserted: number;
  usedFallback: boolean; // true when every attempt failed — yesterday's stored rates stand in
}

// Daily ECB reference-rate fetch (§11 FX). Retries the fetch up to 3× then gives up: no write,
// so the previously-stored rates remain the fallback and the caller raises the CloudWatch alarm.
export class FetchDailyFxRatesService {
  constructor(
    private readonly ecb: IEcbRateSource,
    private readonly fxRates: IFxRateRepository,
  ) {}

  async run(): Promise<FxFetchResult> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const daily = await this.ecb.fetchDaily();
        const upserted = await this.fxRates.upsertDaily(daily.date, EUR, daily.rows);
        return { upserted, usedFallback: false };
      } catch {
        // swallow and retry; the caller raises the alarm only after all attempts fail
      }
    }
    return { upserted: 0, usedFallback: true };
  }
}
