import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { SsmTunableParametersAdapter } from '@infrastructure/adapters/admin/SsmTunableParametersAdapter';
import { AdminAuditLogAdapter } from '@infrastructure/adapters/admin/AdminAuditLogAdapter';
import { AdminConfigService } from '@core/services/admin/AdminConfigService';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';
import { REGION, json, parseJsonBody } from './shared';

// Live editing of allowlisted runtime SSM parameters. Reads list all tunables;
// a write validates by type/bounds, persists to SSM, and audits before/after.
export async function handleAdminConfigRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const service = new AdminConfigService(new SsmTunableParametersAdapter(REGION), new AdminAuditLogAdapter(db));

  if (method === 'GET' && path === '/admin/config') {
    return json(200, { parameters: await service.list() });
  }

  const paramMatch = path.match(/^\/admin\/config\/([^/]+)$/);
  if (method === 'PUT' && paramMatch) {
    return updateParam(service, user, paramMatch[1], event, log);
  }

  return json(404, { message: 'Not Found' });
}

async function updateParam(
  service: AdminConfigService,
  user: AppUser,
  key: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  try {
    const value = await service.update({ id: user.id, email: user.email }, key, body.value);
    log.info('admin config update', { actorId: user.id, param: key });
    return json(200, { key, value });
  } catch (err) {
    if (err instanceof UnknownAdminTargetError) return json(404, { message: `Unknown parameter: ${key}` });
    if (err instanceof InvalidAdminInputError) return json(400, { message: err.message });
    throw err;
  }
}
