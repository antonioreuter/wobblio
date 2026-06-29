import { describe, it, expect } from 'vitest';
import { findQuotaParam, normalizeQuotaValue, QUOTA_PARAMS } from '@core/domain/quotaConfig';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';

describe('quotaConfig', () => {
  it('exposes per-role upload caps, the household pool, and the §06 upload limits', () => {
    const keys = QUOTA_PARAMS.map((p) => p.key);
    expect(keys).toContain('standard_uploads_per_week');
    expect(keys).toContain('admin_uploads_per_week');
    expect(keys).toContain('household_uploads_per_week');
    expect(keys).toContain('max_image_bytes');
    expect(keys).toContain('max_pdf_bytes');
    expect(keys).toContain('max_pdf_pages');
    expect(keys.some((k) => k.includes('failure_refunds'))).toBe(false);
    // 4 roles × uploads + household + 3 upload limits
    expect(QUOTA_PARAMS).toHaveLength(8);
  });

  it('coerces the upload-limit params as non-negative integers (never unlimited)', () => {
    const maxImage = findQuotaParam('max_image_bytes');
    expect(maxImage.kind).toBe('upload_limit');
    expect(normalizeQuotaValue(maxImage, 5_000_000)).toBe('5000000');
    expect(() => normalizeQuotaValue(maxImage, -1)).toThrow(InvalidAdminInputError);
  });

  it('rejects a max_pdf_bytes above the Bedrock document ceiling', () => {
    const maxPdf = findQuotaParam('max_pdf_bytes');
    expect(normalizeQuotaValue(maxPdf, 4_500_000)).toBe('4500000');
    // Raising it past the ceiling would re-introduce the Bedrock-crash → quarantine bug.
    expect(() => normalizeQuotaValue(maxPdf, 10_000_000)).toThrow(InvalidAdminInputError);
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
