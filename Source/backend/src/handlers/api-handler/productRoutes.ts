import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import { ProductSearchAdapter } from '@infrastructure/adapters/data-intelligence/ProductSearchAdapter';
import { ProductSearchService } from '@core/services/data-intelligence/ProductSearchService';
import { categoryIdsUnderMacro } from '@core/domain/categoryTaxonomy';
import { isShoppingListCategoryId } from '@core/domain/shoppingList';
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
  // Market merchant count is scoped to the region the trends chart serves (defaults to global).
  const country = event.queryStringParameters?.country ?? '';
  const region = event.queryStringParameters?.region ?? '';
  // §10b: only the shopping-list add-item UI sends this, to lock search to the
  // list's category macro. Unknown/missing values leave the filter off.
  const category = event.queryStringParameters?.category ?? '';
  const categoryIds = isShoppingListCategoryId(category) ? categoryIdsUnderMacro(category) : undefined;
  // PROVISIONAL matches are scoped to the caller's invoice lines via RLS.
  const products = await withTenantTx(db, user.id, () =>
    new ProductSearchService(new ProductSearchAdapter(db)).search(query, undefined, country, region, categoryIds),
  );
  return json(200, { products });
}
