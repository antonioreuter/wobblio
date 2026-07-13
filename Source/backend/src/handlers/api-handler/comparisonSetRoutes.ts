import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import { ComparisonSetRepositoryAdapter } from '@infrastructure/adapters/comparison/ComparisonSetRepositoryAdapter';
import { ComparisonSetService } from '@core/services/comparison/ComparisonSetService';
import {
  ComparisonSetLimitError,
  ComparisonSetNotFoundError,
  InvalidComparisonSetError,
} from '@core/domain/errors';
import { json, parseJsonBody, withTenantTx } from './shared';

// 09/04 — /me/comparison-sets CRUD. Tenant-scoped (standard authorizer); RLS enforces isolation.
export async function handleComparisonSetsRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  if (path === '/me/comparison-sets') {
    if (method === 'GET') return listSets(db, user);
    if (method === 'POST') return createSet(db, user, event);
  }

  const memberMatch = path.match(/^\/me\/comparison-sets\/([^/]+)\/members\/([^/]+)$/);
  if (memberMatch) {
    if (method === 'DELETE') return removeMember(db, user, memberMatch[1], memberMatch[2]);
    if (method === 'PATCH') return toggleSizeEquivalent(db, user, memberMatch[1], memberMatch[2], event);
  }

  const membersMatch = path.match(/^\/me\/comparison-sets\/([^/]+)\/members$/);
  if (method === 'POST' && membersMatch) return addMember(db, user, membersMatch[1], event);

  const setMatch = path.match(/^\/me\/comparison-sets\/([^/]+)$/);
  if (setMatch) {
    if (method === 'GET') return getSet(db, user, setMatch[1]);
    if (method === 'PATCH') return renameSet(db, user, setMatch[1], event);
    if (method === 'DELETE') return deleteSet(db, user, setMatch[1]);
  }

  return json(404, { message: 'Not Found' });
}

function service(db: PoolClient): ComparisonSetService {
  return new ComparisonSetService(new ComparisonSetRepositoryAdapter(db));
}

async function guard(fn: () => Promise<APIGatewayProxyResult>): Promise<APIGatewayProxyResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof InvalidComparisonSetError) return json(400, { message: err.message });
    if (err instanceof ComparisonSetLimitError) return json(409, { message: err.message });
    if (err instanceof ComparisonSetNotFoundError) return json(404, { message: err.message });
    throw err;
  }
}

function listSets(db: PoolClient, user: AppUser): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => json(200, { sets: await service(db).list() })),
  );
}

function getSet(db: PoolClient, user: AppUser, setId: string): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => json(200, await service(db).get(setId))),
  );
}

function createSet(db: PoolClient, user: AppUser, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const name = typeof body.name === 'string' ? body.name : null;
  return guard(() =>
    withTenantTx(db, user.id, async () => json(201, { id: await service(db).create(name) })),
  );
}

function renameSet(db: PoolClient, user: AppUser, setId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const name = typeof body.name === 'string' ? body.name : null;
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await service(db).rename(setId, name);
      return json(200, { updated: true });
    }),
  );
}

function deleteSet(db: PoolClient, user: AppUser, setId: string): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await service(db).remove(setId);
      return json(204, {});
    }),
  );
}

function addMember(db: PoolClient, user: AppUser, setId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const productId = typeof body.productId === 'string' ? body.productId : '';
  const sizeEquivalent = body.sizeEquivalent === true;
  return guard(() =>
    withTenantTx(db, user.id, async () => json(201, { id: await service(db).addMember(setId, productId, sizeEquivalent) })),
  );
}

function removeMember(db: PoolClient, user: AppUser, setId: string, memberId: string): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await service(db).removeMember(setId, memberId);
      return json(204, {});
    }),
  );
}

function toggleSizeEquivalent(db: PoolClient, user: AppUser, setId: string, memberId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const sizeEquivalent = body.sizeEquivalent === true;
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await service(db).setSizeEquivalent(setId, memberId, sizeEquivalent);
      return json(200, { sizeEquivalent });
    }),
  );
}
