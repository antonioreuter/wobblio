import { describe, it, expect } from 'vitest';
import { decideStatus, isArithmeticConsistent } from '@core/domain/ingestion';
import type { ParsedReceipt } from '@core/domain/ingestion';

const receipt = (total: number, lineTotals: number[]): ParsedReceipt => ({
  merchantRaw: 'AH',
  transactionDate: '2026-06-10',
  currency: 'EUR',
  total,
  lines: lineTotals.map(lt => ({ rawText: 'x', quantity: 1, lineTotal: lt })),
  parseConfidence: 0.9,
});

describe('isArithmeticConsistent', () => {
  it('accepts an exact match', () => {
    expect(isArithmeticConsistent(receipt(10, [4, 6]))).toBe(true);
  });

  it('accepts a difference within the €0.05 absolute tolerance', () => {
    expect(isArithmeticConsistent(receipt(10.04, [4, 6]))).toBe(true);
  });

  it('accepts a difference within the 1% relative tolerance on large totals', () => {
    expect(isArithmeticConsistent(receipt(1000, [995]))).toBe(true); // delta 5 <= 1% of 1000
  });

  it('rejects a difference beyond both tolerances', () => {
    expect(isArithmeticConsistent(receipt(10, [4, 4]))).toBe(false); // delta 2
  });
});

describe('decideStatus', () => {
  const ok = { parseConfidence: 0.9, arithmeticOk: true, hasLowConfidenceLine: false, lowConfidenceMerchant: false, isSuspectedDuplicate: false };

  it('returns SUSPECTED_DUPLICATE when a fuzzy duplicate is found', () => {
    expect(decideStatus({ ...ok, isSuspectedDuplicate: true })).toBe('SUSPECTED_DUPLICATE');
  });

  it('returns NEEDS_REVIEW when parse confidence is below the threshold', () => {
    expect(decideStatus({ ...ok, parseConfidence: 0.69 })).toBe('NEEDS_REVIEW');
  });

  it('returns NEEDS_REVIEW when the arithmetic check fails', () => {
    expect(decideStatus({ ...ok, arithmeticOk: false })).toBe('NEEDS_REVIEW');
  });

  it('returns NEEDS_REVIEW when a low-confidence line is present', () => {
    expect(decideStatus({ ...ok, hasLowConfidenceLine: true })).toBe('NEEDS_REVIEW');
  });

  it('returns NEEDS_REVIEW when the merchant was resolved with low confidence', () => {
    expect(decideStatus({ ...ok, lowConfidenceMerchant: true })).toBe('NEEDS_REVIEW');
  });

  it('returns PARSED when every signal is healthy', () => {
    expect(decideStatus(ok)).toBe('PARSED');
  });
});
