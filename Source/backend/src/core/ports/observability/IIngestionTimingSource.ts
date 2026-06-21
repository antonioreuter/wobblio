export interface TimingAggregate {
  status: string;
  avgTotalMs: number;
  avgWorkerMs: number;
  count: number;
}

export interface IIngestionTimingSource {
  // Per-status average processing times for the given UTC day (YYYY-MM-DD).
  getDailyAverages(metricDate: string): Promise<TimingAggregate[]>;
}
