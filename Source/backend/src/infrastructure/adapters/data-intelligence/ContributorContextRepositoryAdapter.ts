import type { PoolClient } from 'pg';
import type { IContributorContextRepository } from '@core/ports/data-intelligence/IContributorContextRepository';
import type { ContributorContext } from '@core/domain/priceObservation';

const DEFAULT_TRUST_SCORE = 50; // neutral baseline until the nightly trust cron lands

interface ContextRow {
  price_contribution_optout: boolean;
  region_code: string;
  country_code: string;
  trust_score: number;
  home_currency: string;
}

// Reads the contributor's de-identification context. app_user is RLS-scoped
// (id = current_tenant_id), so the worker must set tenant context first; tenant_trust
// is global. Returns the opt-out default when the row is somehow absent.
export class ContributorContextRepositoryAdapter implements IContributorContextRepository {
  constructor(private readonly client: PoolClient) {}

  async getContext(tenantId: string): Promise<ContributorContext> {
    const result = await this.client.query<ContextRow>(
      `SELECT u.price_contribution_optout, u.region_code, u.country_code, u.home_currency,
              COALESCE(t.trust_score, $2) AS trust_score
       FROM app_user u
       LEFT JOIN tenant_trust t ON t.tenant_id = u.id
       WHERE u.id = $1`,
      [tenantId, DEFAULT_TRUST_SCORE],
    );
    const row = result.rows[0];
    if (!row) return { optedOut: true, regionCode: null, countryCode: 'NL', trustScore: 0, homeCurrency: 'EUR' };
    return {
      optedOut: row.price_contribution_optout,
      regionCode: row.region_code,
      countryCode: row.country_code,
      trustScore: row.trust_score,
      homeCurrency: row.home_currency,
    };
  }
}
