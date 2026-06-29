import type { KpiDailyRow } from '@core/ports/observability/IKpiDailyWriter';

// Per-pipeline daily comparison metrics (NF-01/06). Each lands in kpi_daily with a
// { pipeline_type } dimension so the dashboard can plot LEGACY vs STRANDS side by side.
export const PIPELINE_METRICS = {
  avgProcessingMs: 'pipeline_avg_processing_ms',
  costPerInvoice: 'pipeline_cost_per_invoice',
  needsReviewRate: 'pipeline_needs_review_rate',
  feedbackDownRatio: 'pipeline_feedback_down_ratio',
} as const;

// One day's aggregate for a single pipeline, as returned by admin_pipeline_kpis.
export interface PipelineKpiAggregate {
  pipelineType: string;
  invoiceCount: number;
  avgProcessingMs: number;
  avgCostUsd: number;
  needsReviewCount: number;
  feedbackDown: number;
  feedbackRated: number;
}

const ratio = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : 0;

// Derives the four comparison metrics from the raw aggregate. Rates are guarded against a
// zero denominator (a pipeline with no invoices / no rated feedback reports 0, not NaN).
export function toPipelineKpiRows(metricDate: string, aggregates: PipelineKpiAggregate[]): KpiDailyRow[] {
  return aggregates.flatMap((a) => {
    const dimensions = { pipeline_type: a.pipelineType };
    return [
      { metricDate, metricName: PIPELINE_METRICS.avgProcessingMs, value: a.avgProcessingMs, dimensions },
      { metricDate, metricName: PIPELINE_METRICS.costPerInvoice, value: a.avgCostUsd, dimensions },
      { metricDate, metricName: PIPELINE_METRICS.needsReviewRate, value: ratio(a.needsReviewCount, a.invoiceCount), dimensions },
      { metricDate, metricName: PIPELINE_METRICS.feedbackDownRatio, value: ratio(a.feedbackDown, a.feedbackRated), dimensions },
    ];
  });
}
