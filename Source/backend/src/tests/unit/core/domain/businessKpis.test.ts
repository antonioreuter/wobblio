import { describe, it, expect } from 'vitest';
import { toBusinessKpiRows, MONTHLY_PRICE_EUR } from '@core/domain/businessKpis';

const base = {
  registrations: 10,
  dau: 40,
  mau: 200,
  premiumCount: 8,
  activeUsers: 100,
  feedbackUp: 9,
  feedbackTotal: 12,
};

describe('toBusinessKpiRows', () => {
  it('emits the headline metrics with the MRR proxy', () => {
    const rows = toBusinessKpiRows('2026-06-22', base);
    const byName = Object.fromEntries(rows.map((r) => [r.metricName, r.value]));
    expect(byName.registrations).toBe(10);
    expect(byName.premium_count).toBe(8);
    expect(byName.mrr_eur).toBeCloseTo(8 * MONTHLY_PRICE_EUR, 5);
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
});
