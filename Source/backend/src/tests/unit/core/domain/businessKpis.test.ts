import { describe, it, expect } from 'vitest';
import {
  toBusinessKpiRows,
  toNewMerchantRows,
  toInvoicesByRegionRows,
  toUserCountryRows,
  toInvoiceCountryRows,
  operationalEfficiency,
  MONTHLY_PRICE_EUR,
  NEW_MERCHANTS_METRIC,
  INVOICES_BY_REGION_METRIC,
} from '@core/domain/businessKpis';

const base = {
  registrations: 10,
  dau: 40,
  mau: 200,
  premiumCount: 8,
  activeUsers: 100,
  feedbackUp: 9,
  feedbackTotal: 12,
  feedbackDown: 3,
  invoicesProcessed: 25,
  invoicesFailed: 2,
  newProducts: 4,
  waitlistUsers: 15,
  deletedUsers: 1,
  totalUsers: 130,
  standardUsers: 110,
  invoicesPending: 7,
  usersLowScore: 2,
  invoicesFeedbackPositive: 8,
  invoicesFeedbackNegative: 2,
  invoicesFeedbackNone: 15,
};

describe('toBusinessKpiRows', () => {
  it('emits the headline + operational metrics with the MRR proxy', () => {
    const rows = toBusinessKpiRows('2026-06-22', base);
    const byName = Object.fromEntries(rows.map((r) => [r.metricName, r.value]));
    expect(byName.registrations).toBe(10);
    expect(byName.premium_count).toBe(8);
    expect(byName.mrr_eur).toBeCloseTo(8 * MONTHLY_PRICE_EUR, 5);
    expect(byName.invoices_processed).toBe(25);
    expect(byName.invoices_failed).toBe(2);
    expect(byName.feedback_up).toBe(9);
    expect(byName.feedback_down).toBe(3);
    expect(byName.new_products).toBe(4);
    expect(byName.waitlist_users).toBe(15);
    expect(byName.deleted_users).toBe(1);
    expect(byName.total_users).toBe(130);
    expect(byName.standard_users).toBe(110);
    expect(byName.invoices_pending).toBe(7);
    expect(byName.users_low_score).toBe(2);
    expect(byName.invoices_feedback_positive).toBe(8);
    expect(byName.invoices_feedback_negative).toBe(2);
    expect(byName.invoices_feedback_none).toBe(15);
    // efficiency: 0.6 * (25/27) + 0.4 * (8/10) = 0.5556 + 0.32 = 0.8756 -> 88
    expect(byName.operational_efficiency).toBe(88);
  });

  it('emits {country}-dimensioned user rows (incl. mrr + conversion when active>0)', () => {
    const rows = toUserCountryRows('2026-06-22', [
      { country: 'NL', registrations: 2, totalUsers: 40, premiumCount: 4, standardUsers: 30, waitlistUsers: 5, deletedUsers: 1, activeUsers: 35, usersLowScore: 1 },
      { country: 'PT', registrations: 0, totalUsers: 5, premiumCount: 0, standardUsers: 5, waitlistUsers: 0, deletedUsers: 0, activeUsers: 0, usersLowScore: 0 },
    ]);
    const nl = rows.filter((r) => r.dimensions?.country === 'NL').map((r) => r.metricName);
    expect(nl).toContain('total_users');
    expect(nl).toContain('mrr_eur');
    expect(nl).toContain('conversion_rate'); // NL active>0
    // PT active=0 → no conversion row
    expect(rows.find((r) => r.dimensions?.country === 'PT' && r.metricName === 'conversion_rate')).toBeUndefined();
  });

  it('emits {country}-dimensioned invoice rows + per-country efficiency', () => {
    const rows = toInvoiceCountryRows('2026-06-22', [
      { country: 'NL', invoicesProcessed: 9, invoicesFailed: 1, invoicesPending: 0, feedbackPositive: 4, feedbackNegative: 0, feedbackNone: 5 },
    ]);
    const byName = Object.fromEntries(rows.map((r) => [r.metricName, r.value]));
    expect(byName.invoices_processed).toBe(9);
    expect(byName.operational_efficiency).toBe(94); // 0.6*0.9 + 0.4*1.0 = 0.94
    expect(rows.every((r) => r.dimensions?.country === 'NL')).toBe(true);
  });

  it('operationalEfficiency weights success 0.6 and quality 0.4, null when idle', () => {
    expect(operationalEfficiency({ ...base, invoicesProcessed: 9, invoicesFailed: 1, invoicesFeedbackPositive: 0, invoicesFeedbackNegative: 0 })).toBe(90);
    expect(
      operationalEfficiency({ ...base, invoicesProcessed: 0, invoicesFailed: 0, invoicesFeedbackPositive: 0, invoicesFeedbackNegative: 0 }),
    ).toBeNull();
  });

  it('computes conversion + feedback ratios when denominators are non-zero', () => {
    const rows = toBusinessKpiRows('2026-06-22', base);
    const byName = Object.fromEntries(rows.map((r) => [r.metricName, r.value]));
    expect(byName.conversion_rate).toBeCloseTo(0.08, 5);
    expect(byName.feedback_score).toBeCloseTo(9 / 12, 5);
  });

  it('omits ratio rows when their denominator is zero (no misleading 0/0)', () => {
    const rows = toBusinessKpiRows('2026-06-22', {
      ...base,
      activeUsers: 0,
      feedbackTotal: 0,
    });
    const names = rows.map((r) => r.metricName);
    expect(names).not.toContain('conversion_rate');
    expect(names).not.toContain('feedback_score');
  });

  it('maps new merchants to one dimensioned row per country', () => {
    const rows = toNewMerchantRows('2026-06-22', [
      { country: 'NL', count: 3 },
      { country: 'PT', count: 1 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ metricName: NEW_MERCHANTS_METRIC, value: 3, dimensions: { country: 'NL' } });
  });

  it('maps invoices by region to country/region-dimensioned rows (null region -> empty)', () => {
    const rows = toInvoicesByRegionRows('2026-06-22', [
      { country: 'NL', region: 'NL-NB', count: 5 },
      { country: 'PT', region: null, count: 2 },
    ]);
    expect(rows[0]).toMatchObject({
      metricName: INVOICES_BY_REGION_METRIC,
      value: 5,
      dimensions: { country: 'NL', region: 'NL-NB' },
    });
    expect(rows[1].dimensions).toEqual({ country: 'PT', region: '' });
  });
});
