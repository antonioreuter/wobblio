import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  QueryStatus,
} from '@aws-sdk/client-cloudwatch-logs';
import type { IReprocessCrossWeekSource, CrossWeekTotal } from '@core/ports/observability/IReprocessCrossWeekSource';

// Counts cross-week reprocess events + summed tokens per charged week from the worker's
// `reprocess cross week` log lines (§07.5).
const QUERY = `filter msg = "reprocess cross week"
| stats count(*) as cnt, sum(tokens) as tok by chargedWeek`;

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 60;

// Reads one UTC day of `reprocess cross week` logs via a Logs Insights query and returns
// per-charged-week totals. Mirrors CloudWatchLogsAiUsageAdapter.
export class CloudWatchLogsReprocessAdapter implements IReprocessCrossWeekSource {
  private readonly client: CloudWatchLogsClient;

  constructor(region: string, private readonly logGroupName: string) {
    this.client = new CloudWatchLogsClient({ region });
  }

  async getDailyCrossWeekTotals(metricDate: string): Promise<CrossWeekTotal[]> {
    const startTime = Math.floor(Date.parse(`${metricDate}T00:00:00Z`) / 1000);
    const endTime = startTime + 24 * 60 * 60;

    const { queryId } = await this.client.send(
      new StartQueryCommand({ logGroupName: this.logGroupName, startTime, endTime, queryString: QUERY }),
    );
    if (!queryId) throw new Error('CloudWatch Logs StartQuery returned no queryId');

    const results = await this.pollResults(queryId);
    return results
      .filter((row) => row.chargedWeek)
      .map((row) => ({
        chargedWeek: row.chargedWeek,
        count: Number(row.cnt ?? 0),
        tokens: Number(row.tok ?? 0),
      }));
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
