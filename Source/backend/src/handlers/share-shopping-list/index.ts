import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import type { PoolClient } from 'pg';
import { createLambdaLogger, type LambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { ShoppingListRepositoryAdapter } from '@infrastructure/adapters/lists/ShoppingListRepositoryAdapter';
import { ShoppingListShareRepositoryAdapter } from '@infrastructure/adapters/lists/ShoppingListShareRepositoryAdapter';
import { SecureTokenAdapter } from '@infrastructure/adapters/security/SecureTokenAdapter';
import { buildKmsEncryption } from '@infrastructure/adapters/security/encryptionFactory';
import { ShoppingListShareService } from '@core/services/lists/ShoppingListShareService';
import { InvalidListShareError } from '@core/domain/errors';
import { REGION, json, parseJsonBody, withTenantTx } from '../api-handler/shared';

// Public, unauthenticated resolver + checkbox toggler for a shared shopping list.
// The {token} in the URL is the only credential (an unguessable 256-bit value); the
// list id is never exposed. resolve_shopping_list_share crosses RLS to find the
// target list + its tenant, then every subsequent read/write runs under that
// tenant's RLS scope — so a token only ever exposes/touches its one list, and only
// the checked flag on an item, nothing else (no pricing, no productId, no rename).
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLambdaLogger('share-shopping-list', context.awsRequestId);

  const token = event.pathParameters?.token ?? '';
  if (!token) return json(400, { message: 'Missing share token' });

  const pool = await buildPool(
    process.env.DB_SECRET_ARN!,
    process.env.DB_HOST!,
    process.env.DB_PORT!,
  );
  const client = await pool.connect();
  try {
    const shareService = new ShoppingListShareService(
      new ShoppingListRepositoryAdapter(client),
      new ShoppingListShareRepositoryAdapter(client),
      new SecureTokenAdapter(),
      buildKmsEncryption(REGION),
    );
    const { listId, tenantId } = await shareService.resolveShare(token);

    const itemId = event.pathParameters?.itemId;
    if (event.httpMethod === 'PATCH' && itemId) {
      return await toggleItem(client, tenantId, listId, itemId, event, log);
    }
    return await readList(client, tenantId, listId, log);
  } catch (err) {
    if (err instanceof InvalidListShareError) return json(404, { message: 'This share link is invalid or has expired' });
    throw err;
  } finally {
    client.release();
  }
};

async function readList(
  client: PoolClient,
  tenantId: string,
  listId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const detail = await withTenantTx(client, tenantId, () => new ShoppingListRepositoryAdapter(client).getDetail(listId));
  if (!detail) return json(404, { message: 'Shared list not found' });

  log.info('shared list resolved', { listId });
  return json(200, {
    name: detail.name,
    categoryId: detail.categoryId,
    items: detail.items.map(item => ({
      id: item.id,
      freeText: item.freeText,
      quantity: item.quantity,
      checked: item.checked,
    })),
  });
}

async function toggleItem(
  client: PoolClient,
  tenantId: string,
  listId: string,
  itemId: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  if (typeof body.checked !== 'boolean') return json(400, { message: 'checked (boolean) is required' });

  const updated = await withTenantTx(client, tenantId, () =>
    new ShoppingListRepositoryAdapter(client).updateItem(listId, itemId, { checked: body.checked as boolean }),
  );
  if (!updated) return json(404, { message: 'Item not found' });

  log.info('shared list item toggled', { listId, itemId, checked: body.checked });
  return json(200, { updated: true });
}
