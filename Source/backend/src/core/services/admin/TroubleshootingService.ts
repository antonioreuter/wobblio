import type { IIngestionLogReader, IngestionLogEvent, LogLevel, LogQueryOptions } from '@core/ports/troubleshooting/IIngestionLogReader';
import type { IWorkerRuntimeControl, LogLevelState } from '@core/ports/troubleshooting/IWorkerRuntimeControl';
import type { IQueueHealthSource, QueueHealth } from '@core/ports/troubleshooting/IQueueHealthSource';
import type { IWorkerMetricsSource, WorkerMetricPoint } from '@core/ports/troubleshooting/IWorkerMetricsSource';
import type { IAdminAuditLog, AdminActor } from '@core/ports/admin/IAdminAuditLog';
import { InvalidAdminInputError } from '@core/domain/errors';

const LEVELS: readonly LogLevel[] = ['error', 'warn', 'info', 'debug'];
const MAX_LOG_WINDOW_MIN = 24 * 60;
const MAX_LOG_LIMIT = 200;
const MAX_DEBUG_TTL_MIN = 8 * 60;
const DEFAULT_DEBUG_TTL_MIN = 60;
const MAX_METRIC_HOURS = 48;

// Operator triage for the ingestion path: live logs, log-level control (with an
// auto-revert deadline), queue depth, and the worker error-rate series. Pure
// orchestration over ports — every concrete AWS call lives in an adapter.
export class TroubleshootingService {
  constructor(
    private readonly logs: IIngestionLogReader,
    private readonly control: IWorkerRuntimeControl,
    private readonly queues: IQueueHealthSource,
    private readonly metrics: IWorkerMetricsSource,
    private readonly audit: IAdminAuditLog,
  ) {}

  queryLogs(raw: Partial<LogQueryOptions>): Promise<IngestionLogEvent[]> {
    const options: LogQueryOptions = {
      minutes: clamp(raw.minutes ?? 30, 1, MAX_LOG_WINDOW_MIN),
      minLevel: LEVELS.includes(raw.minLevel as LogLevel) ? (raw.minLevel as LogLevel) : 'info',
      search: normalizeSearch(raw.search),
      limit: clamp(raw.limit ?? 100, 1, MAX_LOG_LIMIT),
    };
    return this.logs.query(options);
  }

  getLogLevel(): Promise<LogLevelState> {
    return this.control.getLogLevel();
  }

  // Raise/lower the worker's log level. A debug level gets a bounded auto-revert
  // deadline so it cannot be left on; any other level is permanent and clears it.
  async setLogLevel(actor: AdminActor, level: string, ttlMinutes?: number): Promise<LogLevelState> {
    if (!LEVELS.includes(level as LogLevel)) {
      throw new InvalidAdminInputError(`Unknown log level: ${level}`);
    }
    const before = await this.control.getLogLevel();
    const expiresAt = resolveExpiry(level as LogLevel, ttlMinutes);
    await this.control.setLogLevel(level as LogLevel, expiresAt);
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: 'loglevel.change',
      target: 'ingestion-worker',
      before: before.configuredLevel,
      after: level,
    });
    return this.control.getLogLevel();
  }

  getQueueHealth(): Promise<QueueHealth> {
    return this.queues.getHealth();
  }

  getErrorSeries(hours: number): Promise<WorkerMetricPoint[]> {
    return this.metrics.getErrorSeries(clamp(hours, 1, MAX_METRIC_HOURS));
  }
}

function resolveExpiry(level: LogLevel, ttlMinutes?: number): Date | null {
  if (level !== 'debug') return null;
  const ttl = clamp(ttlMinutes ?? DEFAULT_DEBUG_TTL_MIN, 1, MAX_DEBUG_TTL_MIN);
  return new Date(Date.now() + ttl * 60 * 1000);
}

function normalizeSearch(search: string | null | undefined): string | null {
  const trimmed = (search ?? '').trim();
  return trimmed.length > 0 ? trimmed.slice(0, 200) : null;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
