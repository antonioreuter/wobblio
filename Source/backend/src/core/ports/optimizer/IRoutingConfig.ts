import type { OptimizerConfig } from '@core/domain/routeOptimizer';

// SSM-backed routing thresholds: min_split_saving_eur + max_stores (§6.5.3).
export interface IRoutingConfig {
  get(): Promise<OptimizerConfig>;
}
