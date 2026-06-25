import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SsmUploadQuotaAdapter } from '@infrastructure/adapters/quota/SsmUploadQuotaAdapter';
import { SSMClient } from '@aws-sdk/client-ssm';

// One GetParameters response covering every cap the adapter loads in a single call.
const ALL_CAPS = {
  Parameters: [
    { Name: '/wobblio/config/quotas/household_uploads_per_week', Value: '20' },
    { Name: '/wobblio/config/quotas/standard_uploads_per_week', Value: '3' },
    { Name: '/wobblio/config/quotas/premium_uploads_per_week', Value: '10' },
    { Name: '/wobblio/config/quotas/tester_uploads_per_week', Value: '-1' },
    { Name: '/wobblio/config/quotas/admin_uploads_per_week', Value: '-1' },
    { Name: '/wobblio/config/quotas/standard_failure_refunds_per_week', Value: '1' },
    { Name: '/wobblio/config/quotas/premium_failure_refunds_per_week', Value: '3' },
    { Name: '/wobblio/config/quotas/tester_failure_refunds_per_week', Value: '-1' },
    { Name: '/wobblio/config/quotas/admin_failure_refunds_per_week', Value: '-1' },
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

  it('returns the numeric cap for capped roles', async () => {
    await expect(adapter.getPersonalUploadsCap('STANDARD')).resolves.toBe(3);
    await expect(adapter.getPersonalUploadsCap('PREMIUM')).resolves.toBe(10);
  });

  it('maps the -1 sentinel to Infinity for TESTER/ADMIN', async () => {
    await expect(adapter.getPersonalUploadsCap('TESTER')).resolves.toBe(Number.POSITIVE_INFINITY);
    await expect(adapter.getPersonalUploadsCap('ADMIN')).resolves.toBe(Number.POSITIVE_INFINITY);
  });

  it('resolves household and per-role refund caps', async () => {
    await expect(adapter.getHouseholdUploadsCap()).resolves.toBe(20);
    await expect(adapter.getFailureRefundCap('STANDARD')).resolves.toBe(1);
    await expect(adapter.getFailureRefundCap('ADMIN')).resolves.toBe(Number.POSITIVE_INFINITY);
  });

  it('caches — loads every cap in a single GetParameters call', async () => {
    await adapter.getPersonalUploadsCap('STANDARD');
    await adapter.getFailureRefundCap('PREMIUM');
    await adapter.getHouseholdUploadsCap();
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it('throws when a required cap parameter is missing', async () => {
    sendSpy.mockResolvedValue({ Parameters: [] } as never);
    const fresh = new SsmUploadQuotaAdapter('eu-west-1');
    await expect(fresh.getPersonalUploadsCap('STANDARD')).rejects.toThrow(/missing/);
  });
});
