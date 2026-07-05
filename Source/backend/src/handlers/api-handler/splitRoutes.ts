import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { BillSplitRepositoryAdapter } from '@infrastructure/adapters/splitting/BillSplitRepositoryAdapter';
import { BillSplitShareRepositoryAdapter } from '@infrastructure/adapters/splitting/BillSplitShareRepositoryAdapter';
import { SecureTokenAdapter } from '@infrastructure/adapters/security/SecureTokenAdapter';
import { buildKmsEncryption } from '@infrastructure/adapters/security/encryptionFactory';
import { BillSplitService } from '@core/services/splitting/BillSplitService';
import { ShareBillSplitService } from '@core/services/splitting/ShareBillSplitService';
import { InvoiceNotFoundError, BillSplitNotFoundError, InvalidSplitError } from '@core/domain/errors';
import { REGION, json, parseJsonBody, withTenantTx } from './shared';

// §13.2: bill splitting is a Premium feature. TESTER/ADMIN included for operator/QA access.
const PREMIUM_ROLES = new Set<AppUser['role']>(['PREMIUM', 'TESTER', 'ADMIN']);

export async function handleSplitsRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  if (!PREMIUM_ROLES.has(user.role)) return json(403, { message: 'Bill splitting requires a premium plan' });

  const createMatch = path.match(/^\/invoices\/([^/]+)\/splits$/);
  if (method === 'POST' && createMatch) return createSplit(db, user, createMatch[1], log);

  const summaryMatch = path.match(/^\/invoices\/[^/]+\/splits\/([^/]+)\/summary$/);
  if (method === 'GET' && summaryMatch) return getSummary(db, user, summaryMatch[1]);

  const whatsappMatch = path.match(/^\/invoices\/[^/]+\/splits\/([^/]+)\/whatsapp$/);
  if (method === 'GET' && whatsappMatch) return getWhatsApp(db, user, whatsappMatch[1]);

  const shareMatch = path.match(/^\/invoices\/[^/]+\/splits\/([^/]+)\/share$/);
  if (method === 'POST' && shareMatch) return createShareLink(db, user, shareMatch[1], log);

  const allocationsMatch = path.match(/^\/invoices\/[^/]+\/splits\/([^/]+)\/lines\/([^/]+)\/allocations$/);
  if (method === 'PUT' && allocationsMatch) return setLineAllocations(db, user, allocationsMatch[1], allocationsMatch[2], event, log);

  const detailMatch = path.match(/^\/invoices\/[^/]+\/splits\/([^/]+)$/);
  if (method === 'GET' && detailMatch) return getSplit(db, user, detailMatch[1]);

  return json(404, { message: 'Not Found' });
}

function splitService(db: PoolClient): BillSplitService {
  return new BillSplitService(
    new InvoiceRepositoryAdapter(db),
    new BillSplitRepositoryAdapter(db),
    buildKmsEncryption(REGION),
  );
}

function shareService(db: PoolClient): ShareBillSplitService {
  return new ShareBillSplitService(
    new BillSplitRepositoryAdapter(db),
    new BillSplitShareRepositoryAdapter(db),
    new SecureTokenAdapter(),
    buildKmsEncryption(REGION),
  );
}

// Issues a public read-only /s/<token> link for a split the tenant owns (7-day expiry).
// The token is the unguessable "magic id"; the split id is never exposed.
function createShareLink(
  db: PoolClient,
  user: AppUser,
  splitId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      const share = await shareService(db).createShare(user.id, splitId);
      log.info('bill split share created', { userId: user.id, splitId, shareId: share.shareId });
      const base = process.env.WEB_APP_URL ?? '';
      return json(201, { shareUrl: `${base}/s/${share.token}`, expiresAt: share.expiresAt });
    }),
  );
}

async function guard(fn: () => Promise<APIGatewayProxyResult>): Promise<APIGatewayProxyResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) return json(404, { message: err.message });
    if (err instanceof BillSplitNotFoundError) return json(404, { message: err.message });
    if (err instanceof InvalidSplitError) return json(400, { message: err.message });
    throw err;
  }
}

function createSplit(
  db: PoolClient,
  user: AppUser,
  invoiceId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      const { splitId } = await splitService(db).createSplit(invoiceId);
      log.info('bill split created', { userId: user.id, invoiceId, splitId });
      return json(201, { splitId });
    }),
  );
}

function getSplit(db: PoolClient, user: AppUser, splitId: string): Promise<APIGatewayProxyResult> {
  return guard(() => withTenantTx(db, user.id, async () => json(200, await splitService(db).getSplit(splitId))));
}

function getSummary(db: PoolClient, user: AppUser, splitId: string): Promise<APIGatewayProxyResult> {
  return guard(() => withTenantTx(db, user.id, async () => json(200, await splitService(db).summary(splitId))));
}

function getWhatsApp(db: PoolClient, user: AppUser, splitId: string): Promise<APIGatewayProxyResult> {
  return guard(() => withTenantTx(db, user.id, async () => json(200, await splitService(db).whatsAppExport(splitId))));
}

interface AllocationBody {
  participantName?: unknown;
  units?: unknown;
}

function setLineAllocations(
  db: PoolClient,
  user: AppUser,
  splitId: string,
  lineId: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const raw = Array.isArray(body.allocations) ? (body.allocations as AllocationBody[]) : [];
  const allocations = raw
    .filter((a) => typeof a.participantName === 'string' && typeof a.units === 'number')
    .map((a) => ({ participantName: a.participantName as string, units: a.units as number }));
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await splitService(db).setLineAllocations(splitId, lineId, allocations);
      log.info('bill split line allocations set', { userId: user.id, splitId, lineId, count: allocations.length });
      return json(204, {});
    }),
  );
}
