import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  QueryStatus,
} from '@aws-sdk/client-cloudwatch-logs';
import type { IIngestionTimingSource, TimingAggregate } from '@core/ports/observability/IIngestionTimingSource';

const QUERY = `filter msg = "ingestion timing"
| stats avg(totalMs) as avgTotalMs, avg(workerMs) as avgWorkerMs, count(*) as cnt by status`;

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 60;

// Reads one day of 'ingestion timing' log lines from the worker log group via a
// CloudWatch Logs Insights query and returns per-status averages.
export class CloudWatchLogsTimingSourceAdapter implements IIngestionTimingSource {
  private readonly client: CloudWatchLogsClient;

  constructor(region: string, private readonly logGroupName: string) {
    this.client = new CloudWatchLogsClient({ region });
  }

  async getDailyAverages(metricDate: string): Promise<TimingAggregate[]> {
    const startTime = Math.floor(Date.parse(`${metricDate}T00:00:00Z`) / 1000);
    const endTime = startTime + 24 * 60 * 60;

    const { queryId } = await this.client.send(new StartQueryCommand({
      logGroupName: this.logGroupName,
      startTime,
      endTime,
      queryString: QUERY,
    }));
    if (!queryId) throw new Error('CloudWatch Logs StartQuery returned no queryId');

    const results = await this.pollResults(queryId);
    return results.map(toAggregate);
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

function toRow(fields: Array<{ field?: string; value?: string }>): Record<string, string> {
  const row: Record<string, string> = {};
  for (const { field, value } of fields) {
    if (field && value !== undefined) row[field] = value;
  }
  return row;
}

function toAggregate(row: Record<string, string>): TimingAggregate {
  return {
    status: row.status ?? 'UNKNOWN',
    avgTotalMs: Number(row.avgTotalMs ?? 0),
    avgWorkerMs: Number(row.avgWorkerMs ?? 0),
    count: Number(row.cnt ?? 0),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
