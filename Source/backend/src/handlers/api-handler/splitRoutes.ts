import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { BillSplitRepositoryAdapter } from '@infrastructure/adapters/splitting/BillSplitRepositoryAdapter';
import { buildKmsEncryption } from '@infrastructure/adapters/security/encryptionFactory';
import { BillSplitService } from '@core/services/splitting/BillSplitService';
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

  const assignmentMatch = path.match(/^\/invoices\/[^/]+\/splits\/([^/]+)\/lines\/([^/]+)\/assignment$/);
  if (method === 'DELETE' && assignmentMatch) return removeAssignment(db, user, assignmentMatch[1], assignmentMatch[2], log);

  const lineMatch = path.match(/^\/invoices\/[^/]+\/splits\/([^/]+)\/lines\/([^/]+)$/);
  if (method === 'PATCH' && lineMatch) return assignLine(db, user, lineMatch[1], lineMatch[2], event, log);

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

function assignLine(
  db: PoolClient,
  user: AppUser,
  splitId: string,
  lineId: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const participantName = typeof body.participantName === 'string' ? body.participantName : '';
  const fraction = typeof body.fraction === 'number' ? body.fraction : 1;
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await splitService(db).assignLine(splitId, lineId, participantName, fraction);
      log.info('bill split line assigned', { userId: user.id, splitId, lineId });
      return json(204, {});
    }),
  );
}

function removeAssignment(
  db: PoolClient,
  user: AppUser,
  splitId: string,
  lineId: string,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  return guard(() =>
    withTenantTx(db, user.id, async () => {
      await splitService(db).removeAssignment(splitId, lineId);
      log.info('bill split assignment removed', { userId: user.id, splitId, lineId });
      return json(204, {});
    }),
  );
}
