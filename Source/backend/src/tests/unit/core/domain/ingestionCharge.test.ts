import { describe, it, expect } from 'vitest';
import { shouldChargeIngestion } from '@core/domain/ingestionCharge';

describe('shouldChargeIngestion', () => {
  it('charges a handled run that spent model tokens (parsed, needs-review, unreadable, fuzzy-dup)', () => {
    expect(shouldChargeIngestion(true, 12_345)).toBe(true);
  });

  it('does not charge a duplicate SQS delivery (handled:false, no model ran)', () => {
    expect(shouldChargeIngestion(false, 12_345)).toBe(false);
  });

  it('does not charge when no model ran (zero metered tokens)', () => {
    expect(shouldChargeIngestion(true, 0)).toBe(false);
  });

  it('requires both a handled run and a positive token total', () => {
    expect(shouldChargeIngestion(false, 0)).toBe(false);
  });

  it('charges other model-ran statuses that pass a status through (e.g. FAILED_PROCESSING unreadable)', () => {
    expect(shouldChargeIngestion(true, 5_000, 'FAILED_PROCESSING')).toBe(true);
  });

  it('does NOT charge a primary-only RETAKE_SUGGESTED run (we own the base-model failure)', () => {
    expect(shouldChargeIngestion(true, 5_000, 'RETAKE_SUGGESTED', false)).toBe(false);
  });

  it('DOES charge a RETAKE_SUGGESTED run that escalated to a premium model (no free Opus farming)', () => {
    expect(shouldChargeIngestion(true, 5_000, 'RETAKE_SUGGESTED', true)).toBe(true);
  });
});
