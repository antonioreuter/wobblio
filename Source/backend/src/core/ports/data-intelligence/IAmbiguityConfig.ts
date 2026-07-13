import type { AmbiguityConfig } from '@core/domain/priceAmbiguity';

// 09/05 — the price-ambiguity gap threshold, sourced from SSM so it is tunable live without a
// deploy (like the routing thresholds). Read-side only.
export interface IAmbiguityConfig {
  get(): Promise<AmbiguityConfig>;
}
