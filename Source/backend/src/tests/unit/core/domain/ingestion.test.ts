import { describe, it, expect } from 'vitest';
import { decideStatus, isArithmeticConsistent, isDeletable, isSystemFault, uploadFailureReasonCode } from '@core/domain/ingestion';
import type { ParsedReceipt } from '@core/domain/ingestion';
import { OversizeUploadError, TooManyPagesError, UnsupportedUploadTypeError } from '@core/domain/errors';

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

describe('isDeletable', () => {
  it('blocks an in-flight PROCESSING invoice', () => {
    expect(isDeletable('PROCESSING', null)).toBe(false);
  });

  it('blocks a system-fault-quarantined invoice (systemFaultReason set)', () => {
    expect(isDeletable('FAILED_PROCESSING', '[23514] check drift')).toBe(false);
  });

  it('allows a terminal invoice with no quarantine (incl. user-fault FAILED_PROCESSING)', () => {
    expect(isDeletable('PARSED', null)).toBe(true);
    expect(isDeletable('FAILED_PROCESSING', null)).toBe(true);
    expect(isDeletable('SUSPECTED_DUPLICATE', null)).toBe(true);
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

describe('isSystemFault', () => {
  it('is false for the pre-AI user-fault upload rejects', () => {
    expect(isSystemFault(new OversizeUploadError('inv', 10, 5))).toBe(false);
    expect(isSystemFault(new TooManyPagesError('inv', 12, 10))).toBe(false);
    expect(isSystemFault(new UnsupportedUploadTypeError('image/heic'))).toBe(false);
  });

  it('is true for any other thrown error (our-stack fault → quarantine)', () => {
    expect(isSystemFault(new Error('bedrock exploded'))).toBe(true);
    expect(isSystemFault({ code: '23514' })).toBe(true);
  });
});

describe('uploadFailureReasonCode', () => {
  it('maps an unsupported format to UNSUPPORTED_FORMAT', () => {
    expect(uploadFailureReasonCode(new UnsupportedUploadTypeError('image/heic'))).toBe('UNSUPPORTED_FORMAT');
  });

  it('maps size and page breaches to TOO_LARGE', () => {
    expect(uploadFailureReasonCode(new OversizeUploadError('inv', 10, 5))).toBe('TOO_LARGE');
    expect(uploadFailureReasonCode(new TooManyPagesError('inv', 12, 10))).toBe('TOO_LARGE');
  });
});
