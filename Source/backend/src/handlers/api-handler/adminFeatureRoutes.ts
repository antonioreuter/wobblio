import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { SsmTunableParametersAdapter } from '@infrastructure/adapters/admin/SsmTunableParametersAdapter';
import { AdminAuditLogAdapter } from '@infrastructure/adapters/admin/AdminAuditLogAdapter';
import { AdminFeatureToggleService } from '@core/services/admin/AdminFeatureToggleService';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';
import { REGION, json, parseJsonBody } from './shared';

const AUDIT_HISTORY_LIMIT = 50;

// Operator pipeline toggles (NF-01/05): read current flags, flip one (SSM write + audit), and
// list the toggle history. ADMIN-gated upstream in handleAdminRoute.
export async function handleAdminFeatureRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const service = new AdminFeatureToggleService(
    new SsmTunableParametersAdapter(REGION),
    new AdminAuditLogAdapter(db),
  );

  if (method === 'GET' && path === '/admin/features') {
    return json(200, { features: await service.list() });
  }
  if (method === 'GET' && path === '/admin/features/audit') {
    return json(200, { audits: await service.history(AUDIT_HISTORY_LIMIT) });
  }
  if (method === 'POST' && path === '/admin/features/toggle') {
    return toggleFeature(service, user, event, log);
  }

  return json(404, { message: 'Not Found' });
}

async function toggleFeature(
  service: AdminFeatureToggleService,
  user: AppUser,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const feature = String(body.feature ?? '');
  try {
    const enabled = await service.toggle({ id: user.id, email: user.email }, feature, body.value);
    log.info('admin feature toggle', { actorId: user.id, feature, enabled });
    return json(200, { feature, enabled });
  } catch (err) {
    if (err instanceof UnknownAdminTargetError) return json(404, { message: `Unknown feature: ${feature}` });
    if (err instanceof InvalidAdminInputError) return json(400, { message: err.message });
    throw err;
  }
}
