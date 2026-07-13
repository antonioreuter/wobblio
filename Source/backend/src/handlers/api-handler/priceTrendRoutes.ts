import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import { PriceTrendQueryAdapter } from '@infrastructure/adapters/data-intelligence/PriceTrendQueryAdapter';
import { OwnPurchaseHistoryQueryAdapter } from '@infrastructure/adapters/data-intelligence/OwnPurchaseHistoryQueryAdapter';
import { SsmAmbiguityConfigAdapter } from '@infrastructure/adapters/data-intelligence/SsmAmbiguityConfigAdapter';
import { PriceTrendService } from '@core/services/data-intelligence/PriceTrendService';
import { InvalidTrendQueryError } from '@core/domain/errors';
import { json, REGION, withTenantTx } from './shared';

// §13.2 premium showcase: the de-identified market trend is Premium-only. TESTER and ADMIN
// see it too (operator/QA access). STANDARD still gets their OWN purchase history (their own
// data, no quorum gate) — the webapp renders an inline upgrade prompt for the market overlay.
const PREMIUM_ROLES = new Set<AppUser['role']>(['PREMIUM', 'TESTER', 'ADMIN']);

// One SsmAmbiguityConfigAdapter per warm container so the trend banner's ambiguity gap comes from
// the same SSM-backed source (and cache) as the optimizer, keeping the two views consistent.
const ambiguityConfig = new SsmAmbiguityConfigAdapter(REGION);

// GET /price-trends/comparison?products=<id,id,id>&country=NL&region=NL-NB
// Two series: the global price_observation market trend (RLS-exempt, Premium-only) and the
// caller's own invoice_line history (RLS-scoped — hence withTenantTx). country/region come
// from the caller (defaulted client-side to their profile region, overridable via the picker).
export async function handlePriceTrendsRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  if (method !== 'GET' || path !== '/price-trends/comparison') return json(404, { message: 'Not Found' });

  const query = event.queryStringParameters ?? {};
  const productIds = (query.products ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  const countryCode = (query.country ?? '').toUpperCase();
  const regionCode = query.region ?? '';
  const includeMarketTrend = PREMIUM_ROLES.has(user.role);

  const service = new PriceTrendService(new PriceTrendQueryAdapter(db, ambiguityConfig), new OwnPurchaseHistoryQueryAdapter(db));
  try {
    const comparison = await withTenantTx(db, user.id, () =>
      service.comparison(productIds, countryCode, regionCode, includeMarketTrend),
    );
    return json(200, comparison);
  } catch (err) {
    if (err instanceof InvalidTrendQueryError) return json(400, { message: err.message });
    throw err;
  }
}
