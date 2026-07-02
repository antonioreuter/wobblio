import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PoolClient } from 'pg';
import type { AppUser } from '@core/ports/identity/IAppUserRepository';
import type { LambdaLogger } from '@infrastructure/logging/logger';
import type { LogLevel } from '@core/ports/troubleshooting/IIngestionLogReader';
import { CloudWatchLogsIngestionReaderAdapter } from '@infrastructure/adapters/troubleshooting/CloudWatchLogsIngestionReaderAdapter';
import { LambdaWorkerRuntimeControlAdapter } from '@infrastructure/adapters/troubleshooting/LambdaWorkerRuntimeControlAdapter';
import { SqsQueueHealthAdapter } from '@infrastructure/adapters/troubleshooting/SqsQueueHealthAdapter';
import { CloudWatchWorkerMetricsAdapter } from '@infrastructure/adapters/troubleshooting/CloudWatchWorkerMetricsAdapter';
import { CloudWatchLogsAgenticStageHealthAdapter } from '@infrastructure/adapters/observability/CloudWatchLogsAgenticStageHealthAdapter';
import { SsmTunableParametersAdapter } from '@infrastructure/adapters/admin/SsmTunableParametersAdapter';
import { AdminAuditLogAdapter } from '@infrastructure/adapters/admin/AdminAuditLogAdapter';
import { TroubleshootingService } from '@core/services/admin/TroubleshootingService';
import { AgenticPipelineHealthService } from '@core/services/admin/AgenticPipelineHealthService';
import { isFlagEnabled } from '@core/domain/featureFlags';
import { InvalidAdminInputError } from '@core/domain/errors';
import { REGION, json, parseJsonBody } from './shared';

const AGENTIC_FLAG_PATH = '/wobblio/config/features/agentic_pipeline_enabled';
const AGENTIC_QUEUE_URL_PATH = '/wobblio/config/queues/agentic_url';
const AGENTIC_DLQ_URL_PATH = '/wobblio/config/queues/agentic_dlq_url';
const AGENTIC_STAGE_HEALTH_MINUTES = 60;
// Just under the frontend's 15s auto-refresh cadence, so a warm container reuses one snapshot
// across every poll (and across concurrent admin tabs) instead of re-reading SSM and re-scanning
// the full 60-minute Logs Insights window on every request.
const AGENTIC_HEALTH_CACHE_TTL_MS = 10_000;

let agenticFlagStore: SsmTunableParametersAdapter | null = null;
let agenticHealthCache: { expiresAt: number; body: Record<string, unknown> } | null = null;

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

  if (method === 'GET' && path === '/admin/troubleshooting/agentic-pipeline') {
    return getAgenticPipelineHealth();
  }

  return json(404, { message: 'Not Found' });
}

// Agentic (STRANDS) pipeline lives in a separate CDK stack (WobblioDataAiPipelineStack),
// deployed after this one — its queue URLs aren't available as Lambda env vars, so they're
// read from SSM at request time (same params the confirm-time routing adapter reads). The
// log group name IS deterministic (config.resourceName), so it's a plain env var like the
// legacy worker's.
async function getAgenticPipelineHealth(): Promise<APIGatewayProxyResult> {
  if (agenticHealthCache && Date.now() < agenticHealthCache.expiresAt) {
    return json(200, agenticHealthCache.body);
  }

  const body = await fetchAgenticPipelineHealth();
  agenticHealthCache = { expiresAt: Date.now() + AGENTIC_HEALTH_CACHE_TTL_MS, body };
  return json(200, body);
}

async function fetchAgenticPipelineHealth(): Promise<Record<string, unknown>> {
  const store = agenticFlagStore ?? (agenticFlagStore = new SsmTunableParametersAdapter(REGION));
  const values = await store.getValues([AGENTIC_FLAG_PATH, AGENTIC_QUEUE_URL_PATH, AGENTIC_DLQ_URL_PATH]);
  const enabled = isFlagEnabled(values[AGENTIC_FLAG_PATH]);
  const queueUrl = values[AGENTIC_QUEUE_URL_PATH];
  const dlqUrl = values[AGENTIC_DLQ_URL_PATH];

  if (!enabled || !queueUrl || !dlqUrl) {
    return { enabled: false, queueHealth: null, stages: [] };
  }

  const logGroup = process.env.AGENTIC_WORKER_LOG_GROUP ?? '';
  const service = new AgenticPipelineHealthService(
    new SqsQueueHealthAdapter(REGION, queueUrl, dlqUrl),
    new CloudWatchLogsAgenticStageHealthAdapter(REGION, logGroup),
  );
  const health = await service.getHealth(AGENTIC_STAGE_HEALTH_MINUTES);
  return { enabled: true, ...health };
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
