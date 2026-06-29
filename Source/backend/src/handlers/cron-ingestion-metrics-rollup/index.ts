import type { Context } from 'aws-lambda';
import type { Pool } from 'pg';
import { createLambdaLogger, type LambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { CloudWatchLogsTimingSourceAdapter } from '@infrastructure/adapters/observability/CloudWatchLogsTimingSourceAdapter';
import { CloudWatchLogsAiUsageAdapter } from '@infrastructure/adapters/observability/CloudWatchLogsAiUsageAdapter';
import { CloudWatchLogsReprocessAdapter } from '@infrastructure/adapters/observability/CloudWatchLogsReprocessAdapter';
import { BusinessKpiDbAdapter } from '@infrastructure/adapters/observability/BusinessKpiDbAdapter';
import { KpiDailyRepositoryAdapter } from '@infrastructure/adapters/observability/KpiDailyRepositoryAdapter';
import { IngestionMetricsRollupService } from '@core/services/observability/IngestionMetricsRollupService';
import { BusinessKpiRollupService } from '@core/services/observability/BusinessKpiRollupService';
import { AiSpendRollupService } from '@core/services/observability/AiSpendRollupService';
import { ReprocessCrossWeekRollupService } from '@core/services/observability/ReprocessCrossWeekRollupService';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Daily EventBridge cron: roll days into kpi_daily — ingestion timing (per status),
// business KPIs (registrations/DAU/MAU/premium/users/invoices/feedback/products), and
// AI spend (tokens + estimated cost). The dashboards (admin-console 07/08) read straight
// from kpi_daily. Each roll-up is independent; one failing does not block the others.
//
// By default it rolls BOTH yesterday (now finalized) AND today (in-progress) so the
// dashboard reflects same-day uploads; kpi_daily upserts, so the next run overwrites
// today's partial counts with the complete figure. An event { metricDate } overrides
// to a single explicit date (manual backfill).
export const handler = async (event: unknown, context: Context): Promise<void> => {
  const log = createLambdaLogger('cron-ingestion-metrics-rollup', context.awsRequestId);
  const pool = await buildPool(process.env.DB_SECRET_ARN!, process.env.DB_HOST!, process.env.DB_PORT!, 30000);

  for (const metricDate of datesToRoll(event)) {
    await runForDate(pool, metricDate, log);
  }
};

function datesToRoll(event: unknown): string[] {
  const override = (event as { metricDate?: unknown } | null)?.metricDate;
  if (typeof override === 'string' && ISO_DATE.test(override)) return [override];
  return [daysAgoUtc(1), daysAgoUtc(0)];
}

async function runForDate(pool: Pool, metricDate: string, log: LambdaLogger): Promise<void> {
  const kpiWriter = new KpiDailyRepositoryAdapter(pool);
  const ingestionLogGroup = process.env.INGESTION_LOG_GROUP!;

  const rollups: Array<[string, Promise<{ rowsWritten: number }>]> = [
    ['timing', new IngestionMetricsRollupService(
      new CloudWatchLogsTimingSourceAdapter(REGION, ingestionLogGroup), kpiWriter,
    ).run(metricDate)],
    ['business', new BusinessKpiRollupService(new BusinessKpiDbAdapter(pool), kpiWriter).run(metricDate)],
    ['ai_spend', new AiSpendRollupService(
      new CloudWatchLogsAiUsageAdapter(REGION, ingestionLogGroup), kpiWriter,
    ).run(metricDate)],
    ['reprocess_cross_week', new ReprocessCrossWeekRollupService(
      new CloudWatchLogsReprocessAdapter(REGION, ingestionLogGroup), kpiWriter,
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
}

function daysAgoUtc(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
