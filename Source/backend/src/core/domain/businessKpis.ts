import type {
  BusinessKpiSnapshot,
  MerchantCountryCount,
  InvoiceRegionCount,
  UserKpiByCountry,
  InvoiceKpiByCountry,
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
  invoicesFeedbackPositive: 'invoices_feedback_positive',
  invoicesFeedbackNegative: 'invoices_feedback_negative',
  invoicesFeedbackNone: 'invoices_feedback_none',
} as const;

// Dimensioned metrics.
export const NEW_MERCHANTS_METRIC = 'new_merchants'; // dimensions { country }
export const INVOICES_BY_REGION_METRIC = 'invoices_by_region'; // dimensions { country, region }

// Composite operational-efficiency score (0–100): pipeline success rate (processed ÷
// processed+failed) weighted 0.6 + OCR quality rate (positive ÷ positive+negative
// feedback) weighted 0.4. Null when there is no activity to score.
export const OPERATIONAL_EFFICIENCY_METRIC = 'operational_efficiency';

// Ingestion-timing metrics produced by the timing rollup (dimensioned by status).
export const INGESTION_PROCESSING_METRIC = 'ingestion_processing_ms_avg';
export const INGESTION_COUNT_METRIC = 'ingestion_count';

interface EfficiencyInput {
  invoicesProcessed: number;
  invoicesFailed: number;
  invoicesFeedbackPositive: number;
  invoicesFeedbackNegative: number;
}

export function operationalEfficiency(s: EfficiencyInput): number | null {
  const processedTotal = s.invoicesProcessed + s.invoicesFailed;
  const feedbackTotal = s.invoicesFeedbackPositive + s.invoicesFeedbackNegative;
  const parts: { weight: number; value: number }[] = [];
  if (processedTotal > 0) parts.push({ weight: 0.6, value: s.invoicesProcessed / processedTotal });
  if (feedbackTotal > 0) parts.push({ weight: 0.4, value: s.invoicesFeedbackPositive / feedbackTotal });
  if (parts.length === 0) return null;
  const weightSum = parts.reduce((acc, p) => acc + p.weight, 0);
  const score = parts.reduce((acc, p) => acc + p.weight * p.value, 0) / weightSum;
  return Math.round(score * 100);
}

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
    row(metricDate, BUSINESS_METRICS.invoicesFeedbackPositive, s.invoicesFeedbackPositive),
    row(metricDate, BUSINESS_METRICS.invoicesFeedbackNegative, s.invoicesFeedbackNegative),
    row(metricDate, BUSINESS_METRICS.invoicesFeedbackNone, s.invoicesFeedbackNone),
  ];
  if (s.activeUsers > 0) {
    rows.push(row(metricDate, BUSINESS_METRICS.conversion, round(s.premiumCount / s.activeUsers)));
  }
  if (s.feedbackTotal > 0) {
    rows.push(row(metricDate, BUSINESS_METRICS.feedback, round(s.feedbackUp / s.feedbackTotal)));
  }
  const efficiency = operationalEfficiency(s);
  if (efficiency !== null) rows.push(row(metricDate, OPERATIONAL_EFFICIENCY_METRIC, efficiency));
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

// {country}-dimensioned user-metric rows (same metric names as the national totals;
// the dashboard country filter selects national vs per-country by the dimension).
export function toUserCountryRows(metricDate: string, byCountry: UserKpiByCountry[]): KpiDailyRow[] {
  return byCountry.flatMap((c) => {
    const dim = { country: c.country };
    const out: KpiDailyRow[] = [
      cRow(metricDate, BUSINESS_METRICS.registrations, c.registrations, dim),
      cRow(metricDate, BUSINESS_METRICS.totalUsers, c.totalUsers, dim),
      cRow(metricDate, BUSINESS_METRICS.premium, c.premiumCount, dim),
      cRow(metricDate, BUSINESS_METRICS.standardUsers, c.standardUsers, dim),
      cRow(metricDate, BUSINESS_METRICS.waitlistUsers, c.waitlistUsers, dim),
      cRow(metricDate, BUSINESS_METRICS.deletedUsers, c.deletedUsers, dim),
      cRow(metricDate, BUSINESS_METRICS.activeUsers, c.activeUsers, dim),
      cRow(metricDate, BUSINESS_METRICS.usersLowScore, c.usersLowScore, dim),
      cRow(metricDate, BUSINESS_METRICS.mrr, round(c.premiumCount * MONTHLY_PRICE_EUR), dim),
    ];
    if (c.activeUsers > 0) {
      out.push(cRow(metricDate, BUSINESS_METRICS.conversion, round(c.premiumCount / c.activeUsers), dim));
    }
    return out;
  });
}

// {country}-dimensioned invoice-metric rows + per-country operational efficiency.
export function toInvoiceCountryRows(metricDate: string, byCountry: InvoiceKpiByCountry[]): KpiDailyRow[] {
  return byCountry.flatMap((c) => {
    const dim = { country: c.country };
    const out: KpiDailyRow[] = [
      cRow(metricDate, BUSINESS_METRICS.invoicesProcessed, c.invoicesProcessed, dim),
      cRow(metricDate, BUSINESS_METRICS.invoicesFailed, c.invoicesFailed, dim),
      cRow(metricDate, BUSINESS_METRICS.invoicesPending, c.invoicesPending, dim),
      cRow(metricDate, BUSINESS_METRICS.invoicesFeedbackPositive, c.feedbackPositive, dim),
      cRow(metricDate, BUSINESS_METRICS.invoicesFeedbackNegative, c.feedbackNegative, dim),
      cRow(metricDate, BUSINESS_METRICS.invoicesFeedbackNone, c.feedbackNone, dim),
    ];
    const efficiency = operationalEfficiency({
      invoicesProcessed: c.invoicesProcessed,
      invoicesFailed: c.invoicesFailed,
      invoicesFeedbackPositive: c.feedbackPositive,
      invoicesFeedbackNegative: c.feedbackNegative,
    });
    if (efficiency !== null) out.push(cRow(metricDate, OPERATIONAL_EFFICIENCY_METRIC, efficiency, dim));
    return out;
  });
}

function cRow(metricDate: string, metricName: string, value: number, dimensions: Record<string, string>): KpiDailyRow {
  return { metricDate, metricName, value, dimensions };
}

function row(metricDate: string, metricName: string, value: number): KpiDailyRow {
  return { metricDate, metricName, value, dimensions: null };
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
