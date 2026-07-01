import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { ShoppingListRepositoryAdapter } from '@infrastructure/adapters/lists/ShoppingListRepositoryAdapter';
import { ShoppingListShareRepositoryAdapter } from '@infrastructure/adapters/lists/ShoppingListShareRepositoryAdapter';
import { ContributorContextRepositoryAdapter } from '@infrastructure/adapters/data-intelligence/ContributorContextRepositoryAdapter';
import { buildPriceMatrix } from '@infrastructure/adapters/optimizer/priceMatrixFactory';
import { SsmRoutingConfigAdapter } from '@infrastructure/adapters/optimizer/SsmRoutingConfigAdapter';
import { SecureTokenAdapter } from '@infrastructure/adapters/security/SecureTokenAdapter';
import { buildKmsEncryption } from '@infrastructure/adapters/security/encryptionFactory';
import { ShoppingListService } from '@core/services/lists/ShoppingListService';
import { ShoppingListShareService } from '@core/services/lists/ShoppingListShareService';
import { OptimizerService } from '@core/services/optimizer/OptimizerService';
import type { ItemPatch } from '@core/ports/lists/IShoppingListRepository';
import {
  PremiumRequiredError,
  InvalidListError,
  ListLimitError,
  ListNotFoundError,
  ListItemNotFoundError,
  InvalidListShareError,
} from '@core/domain/errors';
import { REGION, json, parseJsonBody, withTenantTx } from './shared';

export async function handleListsRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  if (method === 'POST' && path === '/lists') return createList(db, user, event, log);
  if (method === 'GET' && path === '/lists') return listLists(db, user);

  const itemsMatch = path.match(/^\/lists\/([^/]+)\/items$/);
  if (method === 'POST' && itemsMatch) return addItem(db, user, itemsMatch[1], event);

  const itemMatch = path.match(/^\/lists\/([^/]+)\/items\/([^/]+)$/);
  if (method === 'PATCH' && itemMatch) return updateItem(db, user, itemMatch[1], itemMatch[2], event);
  if (method === 'DELETE' && itemMatch) return removeItem(db, user, itemMatch[1], itemMatch[2]);

  const completeMatch = path.match(/^\/lists\/([^/]+)\/complete$/);
  if (method === 'POST' && completeMatch) return completeList(db, user, completeMatch[1], log);

  const optimizeMatch = path.match(/^\/lists\/([^/]+)\/optimize$/);
  if (method === 'POST' && optimizeMatch) return optimizeList(db, user, optimizeMatch[1], event, log);

  const regionMatch = path.match(/^\/lists\/([^/]+)\/region$/);
  if (method === 'PATCH' && regionMatch) return setListRegion(db, user, regionMatch[1], event);

  const shareMatch = path.match(/^\/lists\/([^/]+)\/share$/);
  if (method === 'POST' && shareMatch) return createShare(db, user, shareMatch[1], log);

  const shareRevokeMatch = path.match(/^\/lists\/([^/]+)\/share\/([^/]+)$/);
  if (method === 'DELETE' && shareRevokeMatch) return revokeShare(db, user, shareRevokeMatch[1], shareRevokeMatch[2], log);

  const detailMatch = path.match(/^\/lists\/([^/]+)$/);
  if (method === 'GET' && detailMatch) return listDetail(db, user, detailMatch[1]);

  return json(404, { message: 'Not Found' });
}

function service(db: PoolClient): ShoppingListService {
  return new ShoppingListService(new ShoppingListRepositoryAdapter(db));
}

function shareService(db: PoolClient): ShoppingListShareService {
  return new ShoppingListShareService(
    new ShoppingListRepositoryAdapter(db),
    new ShoppingListShareRepositoryAdapter(db),
    new SecureTokenAdapter(),
    buildKmsEncryption(REGION),
  );
}

async function guard(fn: () => Promise<APIGatewayProxyResult>): Promise<APIGatewayProxyResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PremiumRequiredError) return json(403, { message: err.message });
    if (err instanceof InvalidListError) return json(400, { message: err.message });
    if (err instanceof ListLimitError) return json(409, { message: err.message });
    if (err instanceof ListNotFoundError) return json(404, { message: err.message });
    if (err instanceof ListItemNotFoundError) return json(404, { message: err.message });
    if (err instanceof InvalidListShareError) return json(404, { message: err.message });
    throw err;
  }
}

function optimizeList(
  db: PoolClient,
  user: AppUser,
  listId: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const excludedMerchantIds = Array.isArray(body.excludedMerchantIds)
    ? body.excludedMerchantIds.filter((id): id is string => typeof id === 'string')
    : [];
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      const service = new OptimizerService(
        new ShoppingListRepositoryAdapter(db),
        buildPriceMatrix(db),
        new SsmRoutingConfigAdapter(REGION),
        new ContributorContextRepositoryAdapter(db),
      );
      const result = await service.optimize(user.id, user.role, listId, excludedMerchantIds);
      log.info('route optimized', { userId: user.id, listId, optimized: result.optimized, excludedMerchantIds });
      return json(200, result);
    }),
  );
}

function createList(
  db: PoolClient,
  user: AppUser,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const name = String(body.name ?? '');
  const categoryId = String(body.categoryId ?? '');
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      const id = await service(db).create(user.id, user.role, name, categoryId);
      log.info('list created', { userId: user.id, listId: id, categoryId });
      return json(201, { id });
    }),
  );
}

function setListRegion(
  db: PoolClient,
  user: AppUser,
  listId: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const regionCode = typeof body.regionCode === 'string' ? body.regionCode : null;
  const countryCode = typeof body.countryCode === 'string' ? body.countryCode : null;
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await service(db).setRegion(user.role, listId, regionCode, countryCode);
      return json(200, { regionCode, countryCode });
    }),
  );
}

function createShare(
  db: PoolClient,
  user: AppUser,
  listId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      const share = await shareService(db).createShare(user.id, listId);
      const base = process.env.WEB_APP_URL ?? '';
      log.info('list share created', { userId: user.id, listId, shareId: share.shareId });
      return json(201, {
        shareId: share.shareId,
        url: `${base}/shared-lists/${share.token}`,
        expiresAt: share.expiresAt,
      });
    }),
  );
}

function revokeShare(
  db: PoolClient,
  user: AppUser,
  listId: string,
  shareId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await shareService(db).revokeShare(listId, shareId);
      log.info('list share revoked', { userId: user.id, listId, shareId });
      return json(204, {});
    }),
  );
}

function listLists(db: PoolClient, user: AppUser): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => json(200, { lists: await service(db).list() })),
  );
}

function listDetail(db: PoolClient, user: AppUser, listId: string): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => json(200, await service(db).getDetail(listId))),
  );
}

function addItem(
  db: PoolClient,
  user: AppUser,
  listId: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const freeText = String(body.freeText ?? '');
  const productId = typeof body.productId === 'string' ? body.productId : null;
  const quantity = typeof body.quantity === 'number' ? body.quantity : 1;
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      const id = await service(db).addItem(listId, freeText, productId, quantity);
      return json(201, { id });
    }),
  );
}

function updateItem(
  db: PoolClient,
  user: AppUser,
  listId: string,
  itemId: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const patch = parseItemPatch(parseJsonBody(event.body));
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await service(db).updateItem(listId, itemId, patch);
      return json(200, { updated: true });
    }),
  );
}

function removeItem(db: PoolClient, user: AppUser, listId: string, itemId: string): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await service(db).removeItem(listId, itemId);
      return json(204, {});
    }),
  );
}

function completeList(
  db: PoolClient,
  user: AppUser,
  listId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await service(db).complete(listId);
      log.info('list completed', { userId: user.id, listId });
      return json(200, { completed: true });
    }),
  );
}

function parseItemPatch(body: Record<string, unknown>): ItemPatch {
  const patch: ItemPatch = {};
  if (typeof body.checked === 'boolean') patch.checked = body.checked;
  if (typeof body.freeText === 'string') patch.freeText = body.freeText;
  if ('productId' in body) patch.productId = body.productId == null ? null : String(body.productId);
  if (typeof body.quantity === 'number') patch.quantity = body.quantity;
  return patch;
}
