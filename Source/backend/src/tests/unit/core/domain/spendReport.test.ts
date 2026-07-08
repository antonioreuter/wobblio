import { describe, it, expect } from 'vitest';
import { isSpendReportView } from '@core/domain/spendReport';

describe('isSpendReportView', () => {
  it('accepts the two drill shapes and rejects anything else', () => {
    expect(isSpendReportView('merchant')).toBe(true);
    expect(isSpendReportView('product')).toBe(true);
    expect(isSpendReportView('store')).toBe(false);
    expect(isSpendReportView('')).toBe(false);
  });
});
