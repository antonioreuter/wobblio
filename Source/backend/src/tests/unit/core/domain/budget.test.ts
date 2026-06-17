import { describe, it, expect } from 'vitest';
import { periodEnd, advanceCycleStart, buildBudgetAlert } from '@core/domain/budget';

describe('periodEnd', () => {
  it('adds 7 days for a WEEK period', () => {
    expect(periodEnd('2026-06-08', 'WEEK')).toBe('2026-06-15');
  });

  it('adds one calendar month for a MONTH period', () => {
    expect(periodEnd('2026-06-08', 'MONTH')).toBe('2026-07-08');
  });

  it('clamps the day to the target month when the start day overflows', () => {
    expect(periodEnd('2026-01-31', 'MONTH')).toBe('2026-02-28');
  });
});

describe('advanceCycleStart', () => {
  it('leaves an open period unchanged', () => {
    expect(advanceCycleStart('2026-06-08', 'WEEK', '2026-06-10')).toBe('2026-06-08');
  });

  it('rolls a single closed week forward', () => {
    expect(advanceCycleStart('2026-06-01', 'WEEK', '2026-06-10')).toBe('2026-06-08');
  });

  it('rolls multiple closed weeks forward to the current one', () => {
    expect(advanceCycleStart('2026-05-01', 'WEEK', '2026-06-10')).toBe('2026-06-05');
  });

  it('rolls closed months forward to the current one', () => {
    expect(advanceCycleStart('2026-04-01', 'MONTH', '2026-06-10')).toBe('2026-06-01');
  });
});

describe('buildBudgetAlert', () => {
  it('builds the 85% alert in English with amounts', () => {
    const { title, body } = buildBudgetAlert('BUDGET_85', 'TOTAL', 100, 85, 'en', 'EUR');
    expect(title).toBe('Budget at 85%');
    expect(body).toContain('total spending');
    expect(body).toContain('€85.00');
    expect(body).toContain('€100.00');
  });

  it('builds the 100% alert in English', () => {
    const { title, body } = buildBudgetAlert('BUDGET_100', 'CATEGORY', 50, 60, 'en', 'EUR');
    expect(title).toBe('Budget reached');
    expect(body).toContain('over the limit');
  });

  it('localizes the 85% alert to Dutch when language starts with nl', () => {
    const { title } = buildBudgetAlert('BUDGET_85', 'TOTAL', 100, 90, 'nl', 'EUR');
    expect(title).toBe('Budget op 85%');
  });

  it('localizes the 100% alert to Dutch', () => {
    const { title, body } = buildBudgetAlert('BUDGET_100', 'MEMBER', 100, 110, 'nl-NL', 'EUR');
    expect(title).toBe('Budget bereikt');
    expect(body).toContain('overschreden');
  });
});
