import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import type { LogLevel } from '@core/ports/troubleshooting/IIngestionLogReader';
import { CloudWatchLogsIngestionReaderAdapter } from '@infrastructure/adapters/troubleshooting/CloudWatchLogsIngestionReaderAdapter';
import { LambdaWorkerRuntimeControlAdapter } from '@infrastructure/adapters/troubleshooting/LambdaWorkerRuntimeControlAdapter';
import { SqsQueueHealthAdapter } from '@infrastructure/adapters/troubleshooting/SqsQueueHealthAdapter';
import { CloudWatchWorkerMetricsAdapter } from '@infrastructure/adapters/troubleshooting/CloudWatchWorkerMetricsAdapter';
import { AdminAuditLogAdapter } from '@infrastructure/adapters/admin/AdminAuditLogAdapter';
import { TroubleshootingService } from '@core/services/admin/TroubleshootingService';
import { InvalidAdminInputError } from '@core/domain/errors';
import { REGION, json, parseJsonBody } from './shared';

// Operator triage of the ingestion path: live worker logs, log-level control,
// queue depth, and the error-rate series. All reads come from CloudWatch/SQS/Lambda
// (least-privilege grants on the api-handler role — see WobblioBackendStack).
export async function handleAdminTroubleshootingRoute(
  db: PoolClient,
  user: AppUser,
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const service = buildService(db);
  const q = event.queryStringParameters ?? {};

  if (method === 'GET' && path === '/admin/troubleshooting/logs') {
    const events = await service.queryLogs({
      minutes: numberOr(q.minutes, 30),
      minLevel: (q.level as LogLevel) ?? 'info',
      search: q.search ?? null,
      limit: numberOr(q.limit, 100),
    });
    return json(200, { events });
  }

  if (method === 'GET' && path === '/admin/troubleshooting/log-level') {
    return json(200, await service.getLogLevel());
  }

  if (method === 'PUT' && path === '/admin/troubleshooting/log-level') {
    return setLogLevel(service, user, event, log);
  }

  if (method === 'GET' && path === '/admin/troubleshooting/queue-health') {
    return json(200, await service.getQueueHealth());
  }

  if (method === 'GET' && path === '/admin/troubleshooting/metrics') {
    return json(200, { series: await service.getErrorSeries(numberOr(q.hours, 24)) });
  }

  return json(404, { message: 'Not Found' });
}

async function setLogLevel(
  service: TroubleshootingService,
  user: AppUser,
  event: APIGatewayProxyEvent,
  log: LambdaLogger,
): Promise<APIGatewayProxyResult> {
  const body = parseJsonBody(event.body);
  const level = String(body.level ?? '');
  const ttlMinutes = body.ttlMinutes === undefined ? undefined : Number(body.ttlMinutes);
  try {
    const state = await service.setLogLevel({ id: user.id, email: user.email }, level, ttlMinutes);
    log.info('admin log level change', { actorId: user.id, level: state.configuredLevel, expiresAt: state.expiresAt });
    return json(200, state);
  } catch (err) {
    if (err instanceof InvalidAdminInputError) return json(400, { message: err.message });
    throw err;
  }
}

function buildService(db: PoolClient): TroubleshootingService {
  const logGroup = process.env.INGESTION_WORKER_LOG_GROUP ?? '';
  const functionName = process.env.INGESTION_WORKER_FUNCTION_NAME ?? '';
  const queueUrl = process.env.INGEST_QUEUE_URL ?? '';
  const dlqUrl = process.env.INGEST_DLQ_URL ?? '';
  return new TroubleshootingService(
    new CloudWatchLogsIngestionReaderAdapter(REGION, logGroup),
    new LambdaWorkerRuntimeControlAdapter(REGION, functionName),
    new SqsQueueHealthAdapter(REGION, queueUrl, dlqUrl),
    new CloudWatchWorkerMetricsAdapter(REGION, functionName),
    new AdminAuditLogAdapter(db),
  );
}

function numberOr(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
