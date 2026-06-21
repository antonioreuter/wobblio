import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import { PriceTrendQueryAdapter } from '@infrastructure/adapters/data-intelligence/PriceTrendQueryAdapter';
import { PriceTrendService } from '@core/services/data-intelligence/PriceTrendService';
import { InvalidTrendQueryError } from '@core/domain/errors';
import { json } from './shared';

// §13.2 premium showcase: the comparison chart is a Premium-only feature. TESTER and
// ADMIN see it too (operator/QA access); STANDARD gets a 403 the webapp renders as the
// upgrade prompt.
const PREMIUM_ROLES = new Set<AppUser['role']>(['PREMIUM', 'TESTER', 'ADMIN']);

// GET /price-trends/comparison?products=<id,id,id>&country=NL&region=NL-NB
// Reads the global price_observation store (no RLS) — country/region come from the
// caller (defaulted client-side to their profile region, overridable via the picker).
export async function handlePriceTrendsRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  if (method !== 'GET' || path !== '/price-trends/comparison') return json(404, { message: 'Not Found' });
  if (!PREMIUM_ROLES.has(user.role)) {
    return json(403, { message: 'Price Trends is available only for Premium.' });
  }

  const query = event.queryStringParameters ?? {};
  const productIds = (query.products ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  const countryCode = (query.country ?? '').toUpperCase();
  const regionCode = query.region ?? '';

  const service = new PriceTrendService(new PriceTrendQueryAdapter(db));
  try {
    return json(200, await service.comparison(productIds, countryCode, regionCode));
  } catch (err) {
    if (err instanceof InvalidTrendQueryError) return json(400, { message: err.message });
    throw err;
  }
}
