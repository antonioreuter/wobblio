import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { CatalogCurationAdapter } from '@infrastructure/adapters/data-intelligence/CatalogCurationAdapter';
import { AdminAuditLogAdapter } from '@infrastructure/adapters/admin/AdminAuditLogAdapter';
import { AdminCurationService, type CatalogKind, type RawQueueQuery } from '@core/services/admin/AdminCurationService';
import { mergeBlockReason } from '@core/domain/catalogMerge';
import { InvalidAdminInputError, UnknownAdminTargetError, MergeNotAllowedError } from '@core/domain/errors';
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

  // Global: past-merge audit history (B4 remediation entry point).
  if (method === 'GET' && path === '/admin/curation/merges') {
    return json(200, { merges: await service.listMerges(50) });
  }

  const kind = matchKind(path);
  if (!kind) return json(404, { message: 'Not Found' });
  const base = `/admin/curation/${kind}s`;

  if (method === 'GET') {
    const aliasMatch = kind === 'product' && path.match(/^\/admin\/curation\/products\/([^/]+)\/aliases$/);
    if (aliasMatch) return json(200, { aliases: await service.listProductAliases(aliasMatch[1]) });
    return runQuery(service, kind, base, path, event);
  }

  // Product-only merge-group + alias-hygiene routes (B3 / B4).
  if (method === 'POST' && kind === 'product') {
    if (path === `${base}/merge-preview`) return runMergePreview(service, event);
    if (path === `${base}/merge-batch`) return runMergeBatch(service, actor, event, log);
    const deact = path.match(/^\/admin\/curation\/products\/([^/]+)\/aliases\/([^/]+)\/deactivate$/);
    if (deact) return runDeactivateAlias(service, actor, deact[1], deact[2], log);
  }

  if (method === 'POST' && path === `${base}/batch`) {
    return runBatch(service, actor, kind, event, log);
  }

  const actionMatch = path.match(new RegExp(`^${base}/([^/]+)/(approve|merge|reject)$`));
  if (method === 'POST' && actionMatch) {
    return runAction(service, actor, kind, actionMatch[1], actionMatch[2], event, log);
  }

  return json(404, { message: 'Not Found' });
}

// Per-source compatibility against the chosen canonical target, so the UI can flag and
// disable incompatible rows before the operator commits the group.
async function runMergePreview(service: AdminCurationService, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const targetId = String(body.targetId ?? '');
  const sourceIds = Array.isArray(body.sourceIds) ? (body.sourceIds as string[]) : [];
  if (!targetId || sourceIds.length === 0) return json(400, { message: 'targetId and sourceIds are required' });
  // Sequential, not Promise.all: every call shares one pg connection, which cannot run
  // queries concurrently.
  const rows = [];
  for (const sourceId of sourceIds) {
    const compatibility = await service.mergeCompatibility(sourceId, targetId);
    const blockReason = compatibility ? mergeBlockReason(compatibility) : 'not_found';
    rows.push({ sourceId, compatibility, blockReason });
  }
  return json(200, { target: targetId, sources: rows });
}

async function runMergeBatch(
  service: AdminCurationService,
  actor: { id: string; email: string },
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const targetId = String(body.targetId ?? '');
  const sourceIds = Array.isArray(body.sourceIds) ? (body.sourceIds as string[]) : [];
  try {
    const result = await service.mergeBatch(actor, targetId, sourceIds);
    log.info('admin curation merge-batch', { actorId: actor.id, targetId, applied: result.applied.length, skipped: result.skipped.length });
    return json(200, result);
  } catch (err) {
    if (err instanceof InvalidAdminInputError) return json(400, { message: err.message });
    throw err;
  }
}

async function runDeactivateAlias(
  service: AdminCurationService,
  actor: { id: string; email: string },
  productId: string,
  aliasId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  try {
    await service.deactivateAlias(actor, productId, aliasId);
    log.info('admin curation alias deactivate', { actorId: actor.id, productId, aliasId });
    return json(200, { ok: true });
  } catch (err) {
    if (err instanceof UnknownAdminTargetError) return json(404, { message: 'Alias not found' });
    throw err;
  }
}

// Read endpoints: the filtered/paginated queue + the facets that drive the country
// selector, the per-category pie, and the optional region selector.
async function runQuery(
  service: AdminCurationService,
  kind: CatalogKind,
  base: string,
  path: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const q = event.queryStringParameters ?? {};
  try {
    if (path === base) return json(200, { items: await service.list(kind, parseQuery(q)) });
    if (path === `${base}/countries`) return json(200, { countries: await service.countries(kind) });
    if (path === `${base}/categories`) return json(200, { categories: await service.categories(kind, q.country ?? '', q.region ?? null) });
    if (path === `${base}/regions`) return json(200, { regions: await service.regions(kind, q.country ?? '') });
    return json(404, { message: 'Not Found' });
  } catch (err) {
    if (err instanceof InvalidAdminInputError) return json(400, { message: err.message });
    throw err;
  }
}

function parseQuery(q: Record<string, string | undefined>): RawQueueQuery {
  return {
    country: q.country,
    region: q.region,
    category: q.category,
    sort: q.sort,
    limit: q.limit !== undefined ? Number(q.limit) : undefined,
    offset: q.offset !== undefined ? Number(q.offset) : undefined,
  };
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
    if (err instanceof MergeNotAllowedError) return json(409, { message: err.message, reason: err.reason });
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
