import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { SsmTunableParametersAdapter } from '@infrastructure/adapters/admin/SsmTunableParametersAdapter';
import { AdminAuditLogAdapter } from '@infrastructure/adapters/admin/AdminAuditLogAdapter';
import { AdminQuotaConfigService } from '@core/services/admin/AdminQuotaConfigService';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';
import { REGION, json, parseJsonBody } from './shared';

// Live editing of the global per-role quota caps (admin-console: quotas page).
// Reads list every cap; a write validates by type/bounds, persists to SSM, audits.
export async function handleAdminQuotaConfigRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const service = new AdminQuotaConfigService(new SsmTunableParametersAdapter(REGION), new AdminAuditLogAdapter(db));

  if (method === 'GET' && path === '/admin/quotas') {
    return json(200, { quotas: await service.list() });
  }

  const keyMatch = path.match(/^\/admin\/quotas\/([^/]+)$/);
  if (method === 'PUT' && keyMatch) {
    return updateQuota(service, user, keyMatch[1], event, log);
  }

  return json(404, { message: 'Not Found' });
}

async function updateQuota(
  service: AdminQuotaConfigService,
  user: AppUser,
  key: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  try {
    const value = await service.update({ id: user.id, email: user.email }, key, body.value);
    log.info('admin quota config update', { actorId: user.id, quota: key, value });
    return json(200, { key, value });
  } catch (err) {
    if (err instanceof UnknownAdminTargetError) return json(404, { message: `Unknown quota: ${key}` });
    if (err instanceof InvalidAdminInputError) return json(400, { message: err.message });
    throw err;
  }
}
