import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  QueryStatus,
} from '@aws-sdk/client-cloudwatch-logs';
import type {
  IIngestionLogReader,
  IngestionLogEvent,
  LogLevel,
  LogQueryOptions,
} from '@core/ports/troubleshooting/IIngestionLogReader';

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 30;

// pino emits numeric levels; CloudWatch Logs Insights parses them out of the JSON
// @message. Floor → numeric so 'error' shows only ≥50, 'info' shows ≥30, etc.
const LEVEL_FLOOR: Record<LogLevel, number> = { error: 50, warn: 40, info: 30, debug: 20 };

// Reads recent ingestion-worker log lines via a Logs Insights query for the admin
// Troubleshooting page. Filters by level/time/text in the query so the core only
// ever receives already-shaped events.
export class CloudWatchLogsIngestionReaderAdapter implements IIngestionLogReader {
  private readonly client: CloudWatchLogsClient;

  constructor(region: string, private readonly logGroupName: string) {
    this.client = new CloudWatchLogsClient({ region });
  }

  async query(options: LogQueryOptions): Promise<IngestionLogEvent[]> {
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - options.minutes * 60;

    const { queryId } = await this.client.send(new StartQueryCommand({
      logGroupName: this.logGroupName,
      startTime,
      endTime,
      queryString: buildQuery(options),
    }));
    if (!queryId) throw new Error('CloudWatch Logs StartQuery returned no queryId');

    const rows = await this.pollResults(queryId);
    return rows.map(toLogEvent);
  }

  private async pollResults(queryId: string): Promise<Array<Record<string, string>>> {
    for (let poll = 0; poll < MAX_POLLS; poll++) {
      const response = await this.client.send(new GetQueryResultsCommand({ queryId }));
      if (response.status === QueryStatus.Complete) return (response.results ?? []).map(toRow);
      if (response.status === QueryStatus.Failed || response.status === QueryStatus.Cancelled) {
        throw new Error(`CloudWatch Logs query ${queryId} ${response.status}`);
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(`CloudWatch Logs query ${queryId} did not complete in time`);
  }
}

function buildQuery(options: LogQueryOptions): string {
  const lines = [
    'fields @timestamp, level, msg, requestId, @message',
    `filter level >= ${LEVEL_FLOOR[options.minLevel]}`,
  ];
  if (options.search) lines.push(`filter @message like ${quoteRegex(options.search)}`);
  lines.push('sort @timestamp desc', `limit ${options.limit}`);
  return lines.join('\n| ');
}

// Logs Insights `like /regex/` — escape regex metacharacters so an id/text match
// is literal and injection-safe.
function quoteRegex(search: string): string {
  return `/${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`;
}

function toRow(fields: Array<{ field?: string; value?: string }>): Record<string, string> {
  const row: Record<string, string> = {};
  for (const { field, value } of fields) {
    if (field && value !== undefined) row[field] = value;
  }
  return row;
}

function toLogEvent(row: Record<string, string>): IngestionLogEvent {
  return {
    timestamp: toIso(row['@timestamp']),
    level: toLevelLabel(row.level),
    message: row.msg ?? '',
    requestId: row.requestId || null,
    raw: row['@message'] ?? '',
  };
}

function toLevelLabel(numeric: string | undefined): LogLevel {
  const n = Number(numeric ?? 0);
  if (n >= 50) return 'error';
  if (n >= 40) return 'warn';
  if (n >= 30) return 'info';
  return 'debug';
}

function toIso(timestamp: string | undefined): string {
  if (!timestamp) return new Date(0).toISOString();
  // Insights returns "yyyy-MM-dd HH:mm:ss.SSS" in UTC.
  const parsed = Date.parse(timestamp.replace(' ', 'T') + 'Z');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
