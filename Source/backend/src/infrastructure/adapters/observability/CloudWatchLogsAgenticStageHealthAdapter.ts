import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import type { AgenticStage } from '@core/domain/agenticStage';
import type { AgenticStageHealth, IAgenticStageHealthSource } from '@core/ports/observability/IAgenticStageHealthSource';
import { runInsightsQuery } from './cloudWatchLogsInsightsQuery';

const AGGREGATE_QUERY = `filter event = "agentic_stage"
| stats count(*) as invocations, sum(outcome = "error") as failures, avg(durationMs) as avgMs by stage`;

// `latest(...)` picks the field from the max-@timestamp row per group, so this returns exactly
// one row per stage with no `limit` — a global row cap here would risk one noisy stage's
// failures crowding out a quieter stage's only failure in the window.
const LAST_FAILURE_QUERY = `filter event = "agentic_stage" and outcome = "error"
| stats latest(@timestamp) as lastFailureAt, latest(invoiceId) as invoiceId, latest(error) as error by stage`;

// Two queries run in parallel (Promise.all below); each must individually stay well under the
// api-handler Lambda's 30s timeout (no override) or a slow CloudWatch response gets the whole
// invocation hard-killed with no response at all. 20 x 1s leaves ~10s headroom for the SSM
// reads and SQS calls in the same request.
const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 20;

// Reads the `agentic_stage` structured logs (StructuredLogAgenticStageInstrumentation) via two
// Logs Insights queries — per-stage counts/latency, and the most recent failure per stage — for
// the admin Troubleshooting page's "which component is failing" view.
export class CloudWatchLogsAgenticStageHealthAdapter implements IAgenticStageHealthSource {
  private readonly client: CloudWatchLogsClient;

  constructor(region: string, private readonly logGroupName: string) {
    this.client = new CloudWatchLogsClient({ region });
  }

  async getStageHealth(minutes: number): Promise<AgenticStageHealth[]> {
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - minutes * 60;

    const [aggregateRows, failureRows] = await Promise.all([
      this.query(AGGREGATE_QUERY, startTime, endTime),
      this.query(LAST_FAILURE_QUERY, startTime, endTime),
    ]);

    const lastFailureByStage = new Map(failureRows.map((row) => [row.stage, toFailure(row)] as const));
    return aggregateRows.map((row) => toStageHealth(row, lastFailureByStage));
  }

  private query(queryString: string, startTime: number, endTime: number): Promise<Array<Record<string, string>>> {
    return runInsightsQuery(this.client, this.logGroupName, queryString, startTime, endTime, MAX_POLLS, POLL_INTERVAL_MS);
  }
}

function toFailure(row: Record<string, string>) {
  return {
    invoiceId: row.invoiceId ?? '',
    message: row.error ?? '',
    timestamp: toIso(row.lastFailureAt),
  };
}

function toStageHealth(row: Record<string, string>, lastFailureByStage: Map<string, ReturnType<typeof toFailure>>): AgenticStageHealth {
  const stage = (row.stage ?? 'UNKNOWN') as AgenticStage;
  return {
    stage,
    invocations: Number(row.invocations ?? 0),
    failures: Number(row.failures ?? 0),
    avgDurationMs: Number(row.avgMs ?? 0),
    lastFailure: lastFailureByStage.get(stage) ?? null,
  };
}

function toIso(timestamp: string | undefined): string {
  if (!timestamp) return new Date(0).toISOString();
  const parsed = Date.parse(timestamp.replace(' ', 'T') + 'Z');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}
