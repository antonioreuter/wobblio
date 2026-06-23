import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { FreeUserCounterAdapter } from '@infrastructure/adapters/waitlist/FreeUserCounterAdapter';
import { SsmWaitlistCapAdapter } from '@infrastructure/adapters/waitlist/SsmWaitlistCapAdapter';
import { WaitlistRepositoryAdapter } from '@infrastructure/adapters/waitlist/WaitlistRepositoryAdapter';
import { SesEmailAdapter } from '@infrastructure/adapters/notifications/SesEmailAdapter';
import { AdminAuditLogAdapter } from '@infrastructure/adapters/admin/AdminAuditLogAdapter';
import { WaitlistReleaseService } from '@core/services/waitlist/WaitlistReleaseService';
import { AdminWaitlistService } from '@core/services/admin/AdminWaitlistService';
import { InvalidAdminInputError } from '@core/domain/errors';
import { REGION, json, parseJsonBody } from './shared';

// Operator visibility into the free-user pool + manual FIFO release. system_counter
// and app_user releases are global / SECURITY DEFINER paths — no tenant context.
export async function handleAdminWaitlistRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const service = buildService(db);

  if (method === 'GET' && path === '/admin/waitlist') {
    return json(200, await service.getOverview());
  }

  if (method === 'POST' && path === '/admin/waitlist/release') {
    return releaseUsers(service, user, event, log);
  }

  return json(404, { message: 'Not Found' });
}

async function releaseUsers(
  service: AdminWaitlistService,
  user: AppUser,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  try {
    const released = await service.release({ id: user.id, email: user.email }, Number(body.count));
    log.info('admin waitlist release', { actorId: user.id, released });
    return json(200, { released });
  } catch (err) {
    if (err instanceof InvalidAdminInputError) return json(400, { message: err.message });
    throw err;
  }
}

function buildService(db: PoolClient): AdminWaitlistService {
  const counter = new FreeUserCounterAdapter(db);
  const capProvider = new SsmWaitlistCapAdapter(REGION);
  const waitlistRepo = new WaitlistRepositoryAdapter(db);
  const releaseService = new WaitlistReleaseService(
    counter,
    capProvider,
    waitlistRepo,
    new SesEmailAdapter(REGION, process.env.SES_FROM_ADDRESS ?? 'noreply@wobblio.nl'),
  );
  return new AdminWaitlistService(counter, capProvider, waitlistRepo, releaseService, new AdminAuditLogAdapter(db));
}
