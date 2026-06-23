import type { BusinessKpiSnapshot } from '@core/ports/observability/IBusinessKpiSource';
import type { KpiDailyRow } from '@core/ports/observability/IKpiDailyWriter';

// Premium monthly-equivalent price used for the MRR proxy. The schema has no
// per-subscription billing state to sum exactly, so MRR is approximated as
// premium accounts × this rate (an estimate the dashboard labels as such).
export const MONTHLY_PRICE_EUR = 4.99;

// Headline metric names persisted to kpi_daily (no dimensions — single series each).
export const BUSINESS_METRICS = {
  registrations: 'registrations',
  dau: 'dau',
  mau: 'mau',
  premium: 'premium_count',
  activeUsers: 'active_users',
  mrr: 'mrr_eur',
  conversion: 'conversion_rate',
  feedback: 'feedback_score',
} as const;

// Maps a day's raw counts into kpi_daily rows. Ratios are emitted only when their
// denominator is non-zero (no row rather than a misleading 0/0).
export function toBusinessKpiRows(metricDate: string, s: BusinessKpiSnapshot): KpiDailyRow[] {
  const rows: KpiDailyRow[] = [
    row(metricDate, BUSINESS_METRICS.registrations, s.registrations),
    row(metricDate, BUSINESS_METRICS.dau, s.dau),
    row(metricDate, BUSINESS_METRICS.mau, s.mau),
    row(metricDate, BUSINESS_METRICS.premium, s.premiumCount),
    row(metricDate, BUSINESS_METRICS.activeUsers, s.activeUsers),
    row(metricDate, BUSINESS_METRICS.mrr, round(s.premiumCount * MONTHLY_PRICE_EUR)),
  ];
  if (s.activeUsers > 0) {
    rows.push(row(metricDate, BUSINESS_METRICS.conversion, round(s.premiumCount / s.activeUsers)));
  }
  if (s.feedbackTotal > 0) {
    rows.push(row(metricDate, BUSINESS_METRICS.feedback, round(s.feedbackUp / s.feedbackTotal)));
  }
  return rows;
}

function row(metricDate: string, metricName: string, value: number): KpiDailyRow {
  return { metricDate, metricName, value, dimensions: null };
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
