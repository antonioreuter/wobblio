import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { SsmModelRegistryAdapter } from '@infrastructure/adapters/ai/SsmModelRegistryAdapter';
import { AdminAuditLogAdapter } from '@infrastructure/adapters/admin/AdminAuditLogAdapter';
import { AdminModelService } from '@core/services/admin/AdminModelService';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';
import { REGION, json, parseJsonBody } from './shared';

// Live swap of the four Bedrock model IDs by role (admin-console 03). Reads list
// current IDs + swap history (filtered audit log); a swap writes SSM + audits.
export async function handleAdminModelRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const service = new AdminModelService(new SsmModelRegistryAdapter(REGION), new AdminAuditLogAdapter(db));

  if (method === 'GET' && path === '/admin/models') {
    return json(200, { models: await service.list() });
  }

  if (method === 'GET' && path === '/admin/models/history') {
    return json(200, { history: await service.history() });
  }

  const roleMatch = path.match(/^\/admin\/models\/([^/]+)$/);
  if (method === 'PUT' && roleMatch && roleMatch[1] !== 'history') {
    return swap(service, user, roleMatch[1], event, log);
  }

  return json(404, { message: 'Not Found' });
}

async function swap(
  service: AdminModelService,
  user: AppUser,
  role: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  try {
    const modelId = await service.swap({ id: user.id, email: user.email }, role, body.modelId);
    log.info('admin model swap', { actorId: user.id, role, modelId });
    return json(200, { role, modelId });
  } catch (err) {
    if (err instanceof UnknownAdminTargetError) return json(404, { message: `Unknown model role: ${role}` });
    if (err instanceof InvalidAdminInputError) return json(400, { message: err.message });
    throw err;
  }
}
