// Hourly invocation/error counts for the ingestion worker over a recent window,
// powering the error-rate sparkline (the DOWN-ratio canary, §6 / model-swap watch).
export interface WorkerMetricPoint {
  timestamp: string; // ISO-8601, start of the hour bucket
  invocations: number;
  errors: number;
}

export interface IWorkerMetricsSource {
  getErrorSeries(hours: number): Promise<WorkerMetricPoint[]>;
}
