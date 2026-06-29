import type { Pool, PoolClient } from 'pg';
import type { IPipelineKpiSource } from '@core/ports/observability/IPipelineKpiSource';
import type { PipelineKpiAggregate } from '@core/domain/pipelineKpis';

interface PipelineKpiRow {
  pipeline_type: string;
  invoice_count: string;
  avg_processing_ms: string;
  avg_cost_usd: string;
  needs_review_count: string;
  feedback_down: string;
  feedback_rated: string;
}

// Reads the day's per-pipeline telemetry aggregate through the admin_pipeline_kpis
// SECURITY DEFINER helper (bypasses RLS on invoice_telemetry/invoice_feedback).
export class PipelineKpiDbAdapter implements IPipelineKpiSource {
  constructor(private readonly pool: Pool | PoolClient) {}

  async getDailyByPipeline(metricDate: string): Promise<PipelineKpiAggregate[]> {
    const result = await this.pool.query<PipelineKpiRow>(
      'SELECT * FROM admin_pipeline_kpis($1)',
      [metricDate],
    );
    return result.rows.map((r) => ({
      pipelineType: r.pipeline_type,
      invoiceCount: num(r.invoice_count),
      avgProcessingMs: num(r.avg_processing_ms),
      avgCostUsd: num(r.avg_cost_usd),
      needsReviewCount: num(r.needs_review_count),
      feedbackDown: num(r.feedback_down),
      feedbackRated: num(r.feedback_rated),
    }));
  }
}

function num(value: string | null | undefined): number {
  return Number(value ?? 0);
}
