import { describe, it, expect } from 'vitest';
import { assessInvoiceIntegrity, isInvoiceIntegral } from '@core/domain/invoiceGlobalEligibility';

const integral = { parseConfidence: 0.95, arithmeticOk: true, isSuspectedDuplicate: false };

describe('invoiceGlobalEligibility.assessInvoiceIntegrity', () => {
  it('a clean parse is integral with no reasons', () => {
    expect(assessInvoiceIntegrity(integral)).toEqual({ integral: true, reasons: [] });
    expect(isInvoiceIntegral(integral)).toBe(true);
  });

  it('low vision confidence indicts the whole receipt', () => {
    const r = assessInvoiceIntegrity({ ...integral, parseConfidence: 0.69 });
    expect(r.integral).toBe(false);
    expect(r.reasons).toContain('low_parse_confidence');
  });

  it('the visionMin threshold (0.7) is inclusive', () => {
    expect(isInvoiceIntegral({ ...integral, parseConfidence: 0.7 })).toBe(true);
  });

  it('an arithmetic mismatch indicts the whole receipt', () => {
    const r = assessInvoiceIntegrity({ ...integral, arithmeticOk: false });
    expect(r.integral).toBe(false);
    expect(r.reasons).toContain('arithmetic_mismatch');
  });

  it('a suspected duplicate is non-integral', () => {
    const r = assessInvoiceIntegrity({ ...integral, isSuspectedDuplicate: true });
    expect(r.integral).toBe(false);
    expect(r.reasons).toContain('suspected_duplicate');
  });

  it('accumulates every failing reason', () => {
    const r = assessInvoiceIntegrity({ parseConfidence: 0.1, arithmeticOk: false, isSuspectedDuplicate: true });
    expect(r.reasons).toEqual(['low_parse_confidence', 'arithmetic_mismatch', 'suspected_duplicate']);
  });
});
