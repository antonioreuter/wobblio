import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { CatalogCurationAdapter } from '@infrastructure/adapters/data-intelligence/CatalogCurationAdapter';
import { AdminAuditLogAdapter } from '@infrastructure/adapters/admin/AdminAuditLogAdapter';
import { AdminCurationService, type CatalogKind } from '@core/services/admin/AdminCurationService';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';
import { json, parseJsonBody } from './shared';

// Two provisional-catalog queues (merchants, products) with approve / merge / reject
// + batch, all audited. Promotion respects §6.8 / Appendix A; admin approval is the
// explicit-override path. reject → INACTIVE (no REJECTED status).
export async function handleAdminCurationRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const service = new AdminCurationService(new CatalogCurationAdapter(db), new AdminAuditLogAdapter(db));
  const actor = { id: user.id, email: user.email };

  if (method === 'GET' && path === '/admin/curation/merchants') return json(200, { items: await service.list('merchant') });
  if (method === 'GET' && path === '/admin/curation/products') return json(200, { items: await service.list('product') });

  const kind = matchKind(path);
  if (!kind) return json(404, { message: 'Not Found' });

  if (method === 'POST' && path === `/admin/curation/${kind}s/batch`) {
    return runBatch(service, actor, kind, event, log);
  }

  const actionMatch = path.match(new RegExp(`^/admin/curation/${kind}s/([^/]+)/(approve|merge|reject)$`));
  if (method === 'POST' && actionMatch) {
    return runAction(service, actor, kind, actionMatch[1], actionMatch[2], event, log);
  }

  return json(404, { message: 'Not Found' });
}

function matchKind(path: string): CatalogKind | null {
  if (path.startsWith('/admin/curation/merchants')) return 'merchant';
  if (path.startsWith('/admin/curation/products')) return 'product';
  return null;
}

async function runAction(
  service: AdminCurationService,
  actor: { id: string; email: string },
  kind: CatalogKind,
  id: string,
  action: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  try {
    if (action === 'approve') await service.approve(actor, kind, id);
    else if (action === 'reject') await service.reject(actor, kind, id);
    else await service.merge(actor, kind, id, String(parseJsonBody(event.body).targetId ?? ''));
    log.info('admin curation action', { actorId: actor.id, kind, id, action });
    return json(200, { ok: true });
  } catch (err) {
    if (err instanceof UnknownAdminTargetError) return json(404, { message: 'Entity not found' });
    if (err instanceof InvalidAdminInputError) return json(400, { message: err.message });
    throw err;
  }
}

async function runBatch(
  service: AdminCurationService,
  actor: { id: string; email: string },
  kind: CatalogKind,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const action = body.action === 'reject' ? 'reject' : body.action === 'approve' ? 'approve' : null;
  if (!action) return json(400, { message: "action must be 'approve' or 'reject'" });
  try {
    const applied = await service.batch(actor, kind, action, body.ids as string[]);
    log.info('admin curation batch', { actorId: actor.id, kind, action, applied });
    return json(200, { applied });
  } catch (err) {
    if (err instanceof InvalidAdminInputError) return json(400, { message: err.message });
    throw err;
  }
}
