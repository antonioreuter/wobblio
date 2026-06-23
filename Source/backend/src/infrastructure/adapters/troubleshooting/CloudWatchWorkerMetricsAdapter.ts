import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import type { IWorkerMetricsSource, WorkerMetricPoint } from '@core/ports/troubleshooting/IWorkerMetricsSource';

const PERIOD_SEC = 3600; // hourly buckets

// Hourly Invocations/Errors for the ingestion worker from the AWS/Lambda namespace,
// aligned into a single series for the Troubleshooting error-rate sparkline.
export class CloudWatchWorkerMetricsAdapter implements IWorkerMetricsSource {
  private readonly client: CloudWatchClient;

  constructor(region: string, private readonly functionName: string) {
    this.client = new CloudWatchClient({ region });
  }

  async getErrorSeries(hours: number): Promise<WorkerMetricPoint[]> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    const res = await this.client.send(new GetMetricDataCommand({
      StartTime: startTime,
      EndTime: endTime,
      ScanBy: 'TimestampAscending',
      MetricDataQueries: [
        this.metricQuery('invocations', 'Invocations'),
        this.metricQuery('errors', 'Errors'),
      ],
    }));

    return alignSeries(res.MetricDataResults ?? []);
  }

  private metricQuery(id: string, metricName: string) {
    return {
      Id: id,
      MetricStat: {
        Metric: {
          Namespace: 'AWS/Lambda',
          MetricName: metricName,
          Dimensions: [{ Name: 'FunctionName', Value: this.functionName }],
        },
        Period: PERIOD_SEC,
        Stat: 'Sum',
      },
      ReturnData: true,
    };
  }
}

interface MetricResult {
  Id?: string;
  Timestamps?: Date[];
  Values?: number[];
}

function alignSeries(results: MetricResult[]): WorkerMetricPoint[] {
  const invocations = byTimestamp(results.find((r) => r.Id === 'invocations'));
  const errors = byTimestamp(results.find((r) => r.Id === 'errors'));
  const stamps = [...new Set([...invocations.keys(), ...errors.keys()])].sort();
  return stamps.map((iso) => ({
    timestamp: iso,
    invocations: invocations.get(iso) ?? 0,
    errors: errors.get(iso) ?? 0,
  }));
}

function byTimestamp(result: MetricResult | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (!result?.Timestamps) return map;
  result.Timestamps.forEach((ts, i) => {
    map.set(ts.toISOString(), result.Values?.[i] ?? 0);
  });
  return map;
}
