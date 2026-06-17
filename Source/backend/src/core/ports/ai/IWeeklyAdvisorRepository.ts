import type { AdvisorFacts } from '@core/domain/weeklyAdvisor';

export interface AdvisorTenant {
  tenantId: string;
  language: string;
  currency: string;
}

// Facts gathered server-side, minus the per-tenant fields carried on AdvisorTenant.
export type AdvisorFactsData = Omit<AdvisorFacts, 'language' | 'currency'>;

export interface AdvisorCard {
  weekStart: string;
  body: string;
  generatedAt: string;
}

export interface IWeeklyAdvisorRepository {
  // Cron-side (cross-tenant via SECURITY DEFINER).
  listEligibleTenants(weekStart: string): Promise<AdvisorTenant[]>;
  gatherFacts(tenantId: string, weekStart: string): Promise<AdvisorFactsData>;
  save(tenantId: string, weekStart: string, body: string): Promise<void>;
  // API-side (RLS-scoped to the caller).
  getCurrent(): Promise<AdvisorCard | null>;
}
