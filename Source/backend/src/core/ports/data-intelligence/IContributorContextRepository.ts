import type { ContributorContext } from '@core/domain/priceObservation';

// Reads the contributor's de-identification context for Stage 5: opt-out flag, ISO
// home region + country (app_user), and current trust score (tenant_trust).
export interface IContributorContextRepository {
  getContext(tenantId: string): Promise<ContributorContext>;
}
