import type { Context } from 'aws-lambda';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { CloudWatchLogsTimingSourceAdapter } from '@infrastructure/adapters/observability/CloudWatchLogsTimingSourceAdapter';
import { KpiDailyRepositoryAdapter } from '@infrastructure/adapters/observability/KpiDailyRepositoryAdapter';
import { IngestionMetricsRollupService } from '@core/services/observability/IngestionMetricsRollupService';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

// Daily EventBridge cron: roll the prior day's 'ingestion timing' logs into per-status
// kpi_daily rows so processing-time history survives log retention and is plottable.
export const handler = async (_event: unknown, context: Context): Promise<void> => {
  const log = createLambdaLogger('cron-ingestion-metrics-rollup', context.awsRequestId);
  const pool = await buildPool(process.env.DB_SECRET_ARN!, process.env.DB_HOST!, process.env.DB_PORT!, 30000);

  const service = new IngestionMetricsRollupService(
    new CloudWatchLogsTimingSourceAdapter(REGION, process.env.INGESTION_LOG_GROUP!),
    new KpiDailyRepositoryAdapter(pool),
  );

  const metricDate = yesterdayUtc();
  const { rowsWritten } = await service.run(metricDate);
  log.info('ingestion metrics rollup complete', { metricDate, rowsWritten });
};

function yesterdayUtc(): string {
  const date = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}
