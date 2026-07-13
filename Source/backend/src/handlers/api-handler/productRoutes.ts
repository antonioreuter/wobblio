import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import { ProductSearchAdapter } from '@infrastructure/adapters/data-intelligence/ProductSearchAdapter';
import { ProductSearchService } from '@core/services/data-intelligence/ProductSearchService';
import { ProductSplitRepositoryAdapter } from '@infrastructure/adapters/data-intelligence/ProductSplitRepositoryAdapter';
import { SplitProductService } from '@core/services/data-intelligence/SplitProductService';
import { categoryIdsUnderMacro } from '@core/domain/categoryTaxonomy';
import { isShoppingListCategoryId } from '@core/domain/shoppingList';
import { ProductNotSplittableError } from '@core/domain/errors';
import { json, parseJsonBody, parseUserSize, withTenantTx } from './shared';

export async function handleProductsRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  if (method === 'GET' && path === '/products/search') return searchProducts(db, user, event);

  // 09/05 user-driven split-resolution of a price-ambiguous product.
  const splitMatch = path.match(/^\/products\/([^/]+)\/split-variant$/);
  if (method === 'POST' && splitMatch) return splitVariant(db, user, splitMatch[1], event);

  return json(404, { message: 'Not Found' });
}

async function searchProducts(db: PoolClient, user: AppUser, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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

// POST /products/{id}/split-variant — { displayName, size?: {packQuantity, baseUnit}, lineIds }.
// The user resolves an ambiguous product by splitting their own identified purchases into a new
// variant at the same merchant. Auto-split is impossible: this only runs from this explicit call.
async function splitVariant(db: PoolClient, user: AppUser, productId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const displayName = typeof body.displayName === 'string' ? body.displayName : '';
  const lineIds = Array.isArray(body.lineIds) ? body.lineIds.filter((id): id is string => typeof id === 'string') : [];
  const size = parseUserSize(body.size);
  try {
    const newProductId = await withTenantTx(db, user.id, () =>
      new SplitProductService(new ProductSplitRepositoryAdapter(db)).split({ productId, displayName, size, lineIds }),
    );
    return json(201, { productId: newProductId });
  } catch (err) {
    if (err instanceof ProductNotSplittableError) return json(400, { message: err.message });
    throw err;
  }
}
