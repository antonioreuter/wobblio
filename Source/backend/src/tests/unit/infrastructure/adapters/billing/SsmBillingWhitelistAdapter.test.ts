import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SsmBillingWhitelistAdapter } from '@infrastructure/adapters/billing/SsmBillingWhitelistAdapter';
import { SSMClient } from '@aws-sdk/client-ssm';

describe('SsmBillingWhitelistAdapter', () => {
  let adapter: SsmBillingWhitelistAdapter;
  let sendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    adapter = new SsmBillingWhitelistAdapter('eu-west-1');
    sendSpy = vi.spyOn(SSMClient.prototype, 'send' as never);
  });

  it('returns true for a whitelisted email (case-insensitive)', async () => {
    sendSpy.mockResolvedValue({ Parameter: { Value: 'a@b.com, allowed@test.nl' } } as never);

    await expect(adapter.isEmailAllowed('ALLOWED@TEST.NL')).resolves.toBe(true);
  });

  it('returns false for an email not in the list', async () => {
    sendSpy.mockResolvedValue({ Parameter: { Value: 'allowed@test.nl' } } as never);

    await expect(adapter.isEmailAllowed('someone-else@test.nl')).resolves.toBe(false);
  });

  it('fails closed when the SSM parameter is empty or missing', async () => {
    sendSpy.mockResolvedValue({ Parameter: { Value: '' } } as never);

    await expect(adapter.isEmailAllowed('anyone@test.nl')).resolves.toBe(false);
  });

  it('caches the parameter — does not hit SSM twice within the TTL window', async () => {
    sendSpy.mockResolvedValue({ Parameter: { Value: 'allowed@test.nl' } } as never);

    await adapter.isEmailAllowed('allowed@test.nl');
    await adapter.isEmailAllowed('allowed@test.nl');
    await adapter.isEmailAllowed('other@test.nl');

    expect(sendSpy).toHaveBeenCalledTimes(1);
  });
});
