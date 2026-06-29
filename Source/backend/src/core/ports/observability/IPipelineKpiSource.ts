import type { PipelineKpiAggregate } from '@core/domain/pipelineKpis';

// One day's invoice_telemetry aggregated per pipeline_type (cross-tenant, via the
// admin_pipeline_kpis SECURITY DEFINER helper). Empty when no invoices were processed.
export interface IPipelineKpiSource {
  getDailyByPipeline(metricDate: string): Promise<PipelineKpiAggregate[]>;
}
