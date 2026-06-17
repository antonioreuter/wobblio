import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import { ProductSearchAdapter } from '@infrastructure/adapters/data-intelligence/ProductSearchAdapter';
import { ProductSearchService } from '@core/services/data-intelligence/ProductSearchService';
import { json, withTenantTx } from './shared';

export async function handleProductsRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  if (method !== 'GET' || path !== '/products/search') return json(404, { message: 'Not Found' });

  const query = event.queryStringParameters?.q ?? '';
  // PROVISIONAL matches are scoped to the caller's invoice lines via RLS.
  const products = await withTenantTx(db, user.id, () =>
    new ProductSearchService(new ProductSearchAdapter(db)).search(query),
  );
  return json(200, { products });
}
