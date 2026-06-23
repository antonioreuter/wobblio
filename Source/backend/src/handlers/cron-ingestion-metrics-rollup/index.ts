import type { Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { CloudWatchLogsTimingSourceAdapter } from '@infrastructure/adapters/observability/CloudWatchLogsTimingSourceAdapter';
import { CloudWatchLogsAiUsageAdapter } from '@infrastructure/adapters/observability/CloudWatchLogsAiUsageAdapter';
import { BusinessKpiDbAdapter } from '@infrastructure/adapters/observability/BusinessKpiDbAdapter';
import { KpiDailyRepositoryAdapter } from '@infrastructure/adapters/observability/KpiDailyRepositoryAdapter';
import { IngestionMetricsRollupService } from '@core/services/observability/IngestionMetricsRollupService';
import { BusinessKpiRollupService } from '@core/services/observability/BusinessKpiRollupService';
import { AiSpendRollupService } from '@core/services/observability/AiSpendRollupService';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

// Daily EventBridge cron: roll the prior day into kpi_daily — ingestion timing (per
// status), business KPIs (registrations/DAU/MAU/premium/conversion/MRR/feedback), and
// AI spend (tokens + estimated cost per model role). The dashboards (admin-console
// 07/08) read straight from kpi_daily. Each roll-up is independent; one failing does
// not block the others.
export const handler = async (_event: unknown, context: Context): Promise<void> => {
  const log = createLambdaLogger('cron-ingestion-metrics-rollup', context.awsRequestId);
  const pool = await buildPool(process.env.DB_SECRET_ARN!, process.env.DB_HOST!, process.env.DB_PORT!, 30000);
  const kpiWriter = new KpiDailyRepositoryAdapter(pool);
  const ingestionLogGroup = process.env.INGESTION_LOG_GROUP!;
  const metricDate = yesterdayUtc();

  const rollups: Array<[string, Promise<{ rowsWritten: number }>]> = [
    ['timing', new IngestionMetricsRollupService(
      new CloudWatchLogsTimingSourceAdapter(REGION, ingestionLogGroup), kpiWriter,
    ).run(metricDate)],
    ['business', new BusinessKpiRollupService(new BusinessKpiDbAdapter(pool), kpiWriter).run(metricDate)],
    // bedrock_usage from the ingestion worker (the dominant AI cost). Advisor-stage
    // spend lives in its own log group — a known minor omission.
    ['ai_spend', new AiSpendRollupService(
      new CloudWatchLogsAiUsageAdapter(REGION, ingestionLogGroup), kpiWriter,
    ).run(metricDate)],
  ];

  for (const [name, run] of rollups) {
    try {
      const { rowsWritten } = await run;
      log.info('kpi rollup complete', { rollup: name, metricDate, rowsWritten });
    } catch (err) {
      log.error('kpi rollup failed', {
        rollup: name,
        metricDate,
        err: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }
};

function yesterdayUtc(): string {
  const date = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}
