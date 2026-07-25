import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { ProductLinkStatus } from '@core/ports/comparison/IProductLinkRepository';
import { ProductLinkRepositoryAdapter } from '@infrastructure/adapters/comparison/ProductLinkRepositoryAdapter';
import { ProductLinkService } from '@core/services/comparison/ProductLinkService';
import { InvalidProductLinkError } from '@core/domain/errors';
import { json, parseJsonBody, withTenantTx } from './shared';

// Fix 10 — /me/product-links. The trend report's suggestion chips write here: POST accepts/dismisses
// a cross-merchant pair; PATCH confirms same-size. Tenant-scoped (standard authorizer); RLS enforces
// isolation. There is no read endpoint — suggestions and plotted lines already carry link state.
export async function handleProductLinksRoute(
  db: PoolClient,
  user: AppUser,
  method: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  if (method === 'GET') return listLinks(db, user, event);
  if (method === 'POST') return setStatus(db, user, event);
  if (method === 'PATCH') return setSizeEquivalent(db, user, event);
  return json(404, { message: 'Not Found' });
}

// GET /me/product-links?products=a,b,c — accepted links among the selected products, for the trend
// report's size-confirm affordance.
function listLinks(db: PoolClient, user: AppUser, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const productIds = (event.queryStringParameters?.products ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  return withTenantTx(db, user.id, async () => json(200, { links: await service(db).linksAmong(productIds) }));
}

function service(db: PoolClient): ProductLinkService {
  return new ProductLinkService(new ProductLinkRepositoryAdapter(db));
}

async function guard(fn: () => Promise<APIGatewayProxyResult>): Promise<APIGatewayProxyResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof InvalidProductLinkError) return json(400, { message: err.message });
    throw err;
  }
}

function setStatus(db: PoolClient, user: AppUser, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const selfProductId = typeof body.selfProductId === 'string' ? body.selfProductId : '';
  const otherProductId = typeof body.otherProductId === 'string' ? body.otherProductId : '';
  const status = body.status;
  if (status !== 'ACCEPTED' && status !== 'DISMISSED') {
    return Promise.resolve(json(400, { message: 'status must be ACCEPTED or DISMISSED' }));
  }
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await service(db).setStatus(selfProductId, otherProductId, status as ProductLinkStatus);
      return json(200, { status });
    }),
  );
}

function setSizeEquivalent(db: PoolClient, user: AppUser, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const selfProductId = typeof body.selfProductId === 'string' ? body.selfProductId : '';
  const otherProductId = typeof body.otherProductId === 'string' ? body.otherProductId : '';
  const sizeEquivalent = body.sizeEquivalent === true;
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await service(db).setSizeEquivalent(selfProductId, otherProductId, sizeEquivalent);
      return json(200, { sizeEquivalent });
    }),
  );
}
