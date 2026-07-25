import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import type { IVisionEscalationSource, VisionEscalationCount } from '@core/ports/observability/IVisionEscalationSource';
import { runInsightsQuery } from './cloudWatchLogsInsightsQuery';

// Counts escalations by the tier that ran, the dominant reason, and the outcome flags.
const QUERY = `filter event = "vision_escalation"
| stats count(*) as cnt by ranTier, reason, usedFallback, fallbackErrored`;

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 60;

// Reads one UTC day of vision_escalation logs via a Logs Insights query (fix 11 sub-spec 06).
export class CloudWatchLogsVisionEscalationAdapter implements IVisionEscalationSource {
  private readonly client: CloudWatchLogsClient;

  constructor(region: string, private readonly logGroupName: string) {
    this.client = new CloudWatchLogsClient({ region });
  }

  async getDailyEscalations(metricDate: string): Promise<VisionEscalationCount[]> {
    const startTime = Math.floor(Date.parse(`${metricDate}T00:00:00Z`) / 1000);
    const endTime = startTime + 24 * 60 * 60;

    const rows = await runInsightsQuery(
      this.client, this.logGroupName, QUERY, startTime, endTime, MAX_POLLS, POLL_INTERVAL_MS,
    );
    return rows
      .filter((row) => row.ranTier)
      .map((row) => ({
        ranTier: row.ranTier,
        reason: row.reason ?? '',
        usedFallback: isTruthy(row.usedFallback),
        fallbackErrored: isTruthy(row.fallbackErrored),
        count: Number(row.cnt ?? 0),
      }));
  }
}

// Logs Insights renders JSON booleans as "1"/"0"; tolerate "true" too for robustness.
function isTruthy(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}
