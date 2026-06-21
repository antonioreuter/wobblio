export interface KpiDailyRow {
  metricDate: string; // YYYY-MM-DD
  metricName: string;
  value: number;
  dimensions: Record<string, string> | null;
}

export interface IKpiDailyWriter {
  upsert(rows: KpiDailyRow[]): Promise<void>;
}
