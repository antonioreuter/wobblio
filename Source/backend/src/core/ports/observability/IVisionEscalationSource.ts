// One UTC day of vision-escalation events (fix 11 decision 2), grouped by the tier that
// actually ran, the dominant reason, and the outcome flags — from the `vision_escalation`
// structured logs via a Logs Insights query. Rolled into kpi_daily so escalation frequency
// and cost survive log retention and are plottable from SQL.
export interface VisionEscalationCount {
  ranTier: string; // FALLBACK (Sonnet) | FALLBACK_DEEP (Opus)
  reason: string; // BLURRY | LOW_CONFIDENCE | ARITHMETIC | COVERAGE | SUSPECT_MULTIBUY
  usedFallback: boolean; // the stronger model's result was taken
  fallbackErrored: boolean; // the stronger model call threw (degraded to primary)
  count: number;
}

export interface IVisionEscalationSource {
  getDailyEscalations(metricDate: string): Promise<VisionEscalationCount[]>;
}
