import { describe, it, expect } from 'vitest';
import { findQuotaParam, normalizeQuotaValue, QUOTA_PARAMS } from '@core/domain/quotaConfig';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';

describe('quotaConfig', () => {
  it('exposes per-role upload + refund caps plus the household pool', () => {
    const keys = QUOTA_PARAMS.map((p) => p.key);
    expect(keys).toContain('standard_uploads_per_week');
    expect(keys).toContain('admin_uploads_per_week');
    expect(keys).toContain('premium_failure_refunds_per_week');
    expect(keys).toContain('household_uploads_per_week');
    // 4 roles × (uploads + refunds) + household
    expect(QUOTA_PARAMS).toHaveLength(9);
  });

  it('throws UnknownAdminTargetError for a key outside the allowlist', () => {
    expect(() => findQuotaParam('nope')).toThrow(UnknownAdminTargetError);
  });

  it('coerces non-negative integers for capped roles', () => {
    const standard = findQuotaParam('standard_uploads_per_week');
    expect(normalizeQuotaValue(standard, '5')).toBe('5');
    expect(normalizeQuotaValue(standard, 0)).toBe('0');
    expect(() => normalizeQuotaValue(standard, -1)).toThrow(InvalidAdminInputError);
    expect(() => normalizeQuotaValue(standard, 2.5)).toThrow(InvalidAdminInputError);
  });

  it('accepts the -1 unlimited sentinel only for TESTER/ADMIN', () => {
    const tester = findQuotaParam('tester_uploads_per_week');
    expect(normalizeQuotaValue(tester, -1)).toBe('-1');
    expect(normalizeQuotaValue(tester, 50)).toBe('50');
    expect(() => normalizeQuotaValue(tester, -2)).toThrow(InvalidAdminInputError);
  });
});
