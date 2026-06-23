import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import type { DlqMessage } from '@core/ports/ingestion/IDeadLetterQueue';
import { SqsDeadLetterQueueAdapter } from '@infrastructure/adapters/ingestion/SqsDeadLetterQueueAdapter';
import { AdminAuditLogAdapter } from '@infrastructure/adapters/admin/AdminAuditLogAdapter';
import { DlqAdminService } from '@core/services/admin/DlqAdminService';
import { InvalidAdminInputError } from '@core/domain/errors';
import { REGION, json, parseJsonBody } from './shared';

const DEFAULT_LIST_LIMIT = 10;

// Operator triage of the ingestion DLQ. The api-handler holds a least-privilege SQS
// grant (DLQ receive/delete + main-queue send) — see WobblioBackendStack.
export async function handleAdminDlqRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const service = buildService(db);
  const actor = { id: user.id, email: user.email };

  if (method === 'GET' && path === '/admin/dlq/messages') {
    const limit = Number(event.queryStringParameters?.limit ?? DEFAULT_LIST_LIMIT);
    const messages = await service.list(Number.isFinite(limit) ? limit : DEFAULT_LIST_LIMIT);
    return json(200, { messages: messages.map((m) => withLogLink(m)) });
  }

  if (method === 'POST' && path === '/admin/dlq/replay-all') {
    return bulk(() => service.replayAll(actor, bodyLimit(event)), 'replay', log, user);
  }

  if (method === 'DELETE' && path === '/admin/dlq/delete-all') {
    return bulk(() => service.deleteAll(actor, bodyLimit(event)), 'delete', log, user);
  }

  const idMatch = path.match(/^\/admin\/dlq\/messages\/([^/]+)$/);
  if (method === 'GET' && idMatch) return getMessage(service, idMatch[1]);
  if (method === 'DELETE' && idMatch) return removeMessage(service, actor, idMatch[1], event, log);

  const replayMatch = path.match(/^\/admin\/dlq\/messages\/([^/]+)\/replay$/);
  if (method === 'POST' && replayMatch) return replayMessage(service, actor, replayMatch[1], event, log);

  return json(404, { message: 'Not Found' });
}

async function getMessage(service: DlqAdminService, messageId: string): Promise<APIGatewayProxyResult> {
  const message = await service.get(messageId);
  if (!message) return json(404, { message: 'Message not found or no longer visible' });
  return json(200, withLogLink(message));
}

async function replayMessage(
  service: DlqAdminService,
  actor: { id: string; email: string },
  messageId: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const receiptHandle = String(body.receiptHandle ?? '');
  const messageBody = String(body.body ?? '');
  if (!receiptHandle || !messageBody) {
    return json(400, { message: 'receiptHandle and body are required' });
  }
  const replayed = await service.replay(actor, messageId, receiptHandle, messageBody);
  log.info('admin dlq replay', { actorId: actor.id, messageId, replayed });
  return json(200, { replayed });
}

async function removeMessage(
  service: DlqAdminService,
  actor: { id: string; email: string },
  messageId: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const receiptHandle = String(parseJsonBody(event.body).receiptHandle ?? '');
  if (!receiptHandle) return json(400, { message: 'receiptHandle is required' });
  const removed = await service.remove(actor, messageId, receiptHandle);
  log.info('admin dlq delete', { actorId: actor.id, messageId, removed });
  return json(200, { removed });
}

async function bulk(
  run: () => Promise<number>,
  verb: 'replay' | 'delete',
  log: LambdaLogger,
  user: AppUser,
): Promise<APIGatewayProxyResult> {
  try {
    const count = await run();
    log.info(`admin dlq ${verb}-all`, { actorId: user.id, count });
    return json(200, { count });
  } catch (err) {
    if (err instanceof InvalidAdminInputError) return json(400, { message: err.message });
    throw err;
  }
}

function bodyLimit(event: APIGatewayProxyEvent): number {
  return Number(parseJsonBody(event.body).limit ?? 100);
}

// Best-effort deep link to the ingestion-worker log group, filtered by the failed
// invoice id, so an operator can jump from a DLQ row to the failure logs. Null when
// the log-group env is unset or the body carried no invoice id.
function withLogLink(message: DlqMessage): DlqMessage & { logsUrl: string | null } {
  const logGroup = process.env.INGESTION_WORKER_LOG_GROUP;
  if (!logGroup || !message.invoiceId) return { ...message, logsUrl: null };
  const group = encodeURIComponent(logGroup);
  const query = encodeURIComponent(`"${message.invoiceId}"`);
  const url =
    `https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}` +
    `#logsV2:log-groups/log-group/${group}/log-events$3FfilterPattern$3D${query}`;
  return { ...message, logsUrl: url };
}

function buildService(db: PoolClient): DlqAdminService {
  const queue = new SqsDeadLetterQueueAdapter(
    REGION,
    process.env.INGEST_DLQ_URL!,
    process.env.INGEST_QUEUE_URL!,
  );
  return new DlqAdminService(queue, new AdminAuditLogAdapter(db));
}
