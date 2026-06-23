import type {
  BusinessKpiSnapshot,
  MerchantCountryCount,
  InvoiceRegionCount,
} from '@core/ports/observability/IBusinessKpiSource';
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
  invoicesProcessed: 'invoices_processed',
  invoicesFailed: 'invoices_failed',
  feedbackUp: 'feedback_up',
  feedbackDown: 'feedback_down',
  newProducts: 'new_products',
  waitlistUsers: 'waitlist_users',
  deletedUsers: 'deleted_users',
  totalUsers: 'total_users',
  standardUsers: 'standard_users',
  invoicesPending: 'invoices_pending',
  usersLowScore: 'users_low_score',
} as const;

// Dimensioned metrics.
export const NEW_MERCHANTS_METRIC = 'new_merchants'; // dimensions { country }
export const INVOICES_BY_REGION_METRIC = 'invoices_by_region'; // dimensions { country, region }

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
    row(metricDate, BUSINESS_METRICS.invoicesProcessed, s.invoicesProcessed),
    row(metricDate, BUSINESS_METRICS.invoicesFailed, s.invoicesFailed),
    row(metricDate, BUSINESS_METRICS.feedbackUp, s.feedbackUp),
    row(metricDate, BUSINESS_METRICS.feedbackDown, s.feedbackDown),
    row(metricDate, BUSINESS_METRICS.newProducts, s.newProducts),
    row(metricDate, BUSINESS_METRICS.waitlistUsers, s.waitlistUsers),
    row(metricDate, BUSINESS_METRICS.deletedUsers, s.deletedUsers),
    row(metricDate, BUSINESS_METRICS.totalUsers, s.totalUsers),
    row(metricDate, BUSINESS_METRICS.standardUsers, s.standardUsers),
    row(metricDate, BUSINESS_METRICS.invoicesPending, s.invoicesPending),
    row(metricDate, BUSINESS_METRICS.usersLowScore, s.usersLowScore),
  ];
  if (s.activeUsers > 0) {
    rows.push(row(metricDate, BUSINESS_METRICS.conversion, round(s.premiumCount / s.activeUsers)));
  }
  if (s.feedbackTotal > 0) {
    rows.push(row(metricDate, BUSINESS_METRICS.feedback, round(s.feedbackUp / s.feedbackTotal)));
  }
  return rows;
}

// One kpi_daily row per country with new merchants that day.
export function toNewMerchantRows(metricDate: string, counts: MerchantCountryCount[]): KpiDailyRow[] {
  return counts.map((c) => ({
    metricDate,
    metricName: NEW_MERCHANTS_METRIC,
    value: c.count,
    dimensions: { country: c.country },
  }));
}

// One kpi_daily row per country/region with invoices uploaded that day.
export function toInvoicesByRegionRows(metricDate: string, counts: InvoiceRegionCount[]): KpiDailyRow[] {
  return counts.map((c) => ({
    metricDate,
    metricName: INVOICES_BY_REGION_METRIC,
    value: c.count,
    dimensions: { country: c.country, region: c.region ?? '' },
  }));
}

function row(metricDate: string, metricName: string, value: number): KpiDailyRow {
  return { metricDate, metricName, value, dimensions: null };
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
