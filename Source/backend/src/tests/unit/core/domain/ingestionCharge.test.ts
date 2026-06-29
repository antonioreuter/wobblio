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
});
