import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SsmUploadQuotaAdapter } from '@infrastructure/adapters/quota/SsmUploadQuotaAdapter';
import { SSMClient } from '@aws-sdk/client-ssm';

// One GetParameters response covering every param the adapter loads in a single call.
// Caps are stored as invoice limits; the adapter returns them in credits (× avg tokens).
// Failure-refund params were decommissioned in 03 — the adapter no longer loads them.
const AVG = 10_000;
const ALL_CAPS = {
  Parameters: [
    { Name: '/wobblio/config/quotas/household_uploads_per_week', Value: '20' },
    { Name: '/wobblio/config/quotas/average_tokens_per_invoice', Value: String(AVG) },
    { Name: '/wobblio/config/quotas/max_image_bytes', Value: '5000000' },
    { Name: '/wobblio/config/quotas/max_pdf_bytes', Value: '4500000' },
    { Name: '/wobblio/config/quotas/max_pdf_pages', Value: '10' },
    { Name: '/wobblio/config/quotas/standard_uploads_per_week', Value: '3' },
    { Name: '/wobblio/config/quotas/premium_uploads_per_week', Value: '10' },
    { Name: '/wobblio/config/quotas/tester_uploads_per_week', Value: '-1' },
    { Name: '/wobblio/config/quotas/admin_uploads_per_week', Value: '-1' },
  ],
};

describe('SsmUploadQuotaAdapter', () => {
  let adapter: SsmUploadQuotaAdapter;
  let sendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    adapter = new SsmUploadQuotaAdapter('eu-west-1');
    sendSpy = vi.spyOn(SSMClient.prototype, 'send' as never);
    sendSpy.mockResolvedValue(ALL_CAPS as never);
  });

  it('returns the credit cap (invoice limit × average tokens) for capped roles', async () => {
    await expect(adapter.getPersonalUploadsCap('STANDARD')).resolves.toBe(3 * AVG);
    await expect(adapter.getPersonalUploadsCap('PREMIUM')).resolves.toBe(10 * AVG);
  });

  it('maps the -1 sentinel to Infinity BEFORE multiplying (unlimited stays unlimited)', async () => {
    await expect(adapter.getPersonalUploadsCap('TESTER')).resolves.toBe(Number.POSITIVE_INFINITY);
    await expect(adapter.getPersonalUploadsCap('ADMIN')).resolves.toBe(Number.POSITIVE_INFINITY);
  });

  it('resolves the household credit cap and the average tokens per invoice', async () => {
    await expect(adapter.getHouseholdUploadsCap()).resolves.toBe(20 * AVG);
    await expect(adapter.getAverageTokensPerInvoice()).resolves.toBe(AVG);
  });

  it('returns the per-upload size/page limits as raw integers (no credit conversion)', async () => {
    await expect(adapter.getMaxImageBytes()).resolves.toBe(5_000_000);
    await expect(adapter.getMaxPdfBytes()).resolves.toBe(4_500_000);
    await expect(adapter.getMaxPdfPages()).resolves.toBe(10);
  });

  it('clamps max_pdf_bytes to the Bedrock document ceiling even if SSM holds a larger value', async () => {
    sendSpy.mockResolvedValue({
      Parameters: [...ALL_CAPS.Parameters.filter((p) => !p.Name.endsWith('max_pdf_bytes')),
        { Name: '/wobblio/config/quotas/max_pdf_bytes', Value: '10000000' }],
    } as never);
    const fresh = new SsmUploadQuotaAdapter('eu-west-1');
    await expect(fresh.getMaxPdfBytes()).resolves.toBe(4_500_000);
  });

  it('caches — loads every cap in a single GetParameters call', async () => {
    await adapter.getPersonalUploadsCap('STANDARD');
    await adapter.getAverageTokensPerInvoice();
    await adapter.getHouseholdUploadsCap();
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it('throws when a required cap parameter is missing', async () => {
    sendSpy.mockResolvedValue({ Parameters: [] } as never);
    const fresh = new SsmUploadQuotaAdapter('eu-west-1');
    await expect(fresh.getPersonalUploadsCap('STANDARD')).rejects.toThrow(/missing/);
  });
});
