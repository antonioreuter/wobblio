import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ShareBillSplitService } from '@core/services/splitting/ShareBillSplitService';
import type { IBillSplitRepository } from '@core/ports/splitting/IBillSplitRepository';
import type { IBillSplitShareRepository } from '@core/ports/splitting/IBillSplitShareRepository';
import type { ISecureToken } from '@core/ports/security/ISecureToken';
import type { IKmsEncryption } from '@core/ports/security/IKmsEncryption';
import { BillSplitNotFoundError, InvalidShareError } from '@core/domain/errors';

describe('ShareBillSplitService', () => {
  let splits: MockedObject<IBillSplitRepository>;
  let shares: MockedObject<IBillSplitShareRepository>;
  let token: MockedObject<ISecureToken>;
  let encryption: MockedObject<IKmsEncryption>;
  let sut: ShareBillSplitService;

  beforeEach(() => {
    splits = {
      create: vi.fn(), getMeta: vi.fn(), listAllocations: vi.fn(), setLineAllocations: vi.fn(),
    };
    shares = { create: vi.fn(), resolve: vi.fn() };
    token = { generate: vi.fn(), hash: vi.fn() };
    encryption = { encrypt: vi.fn(), decrypt: vi.fn() };
    sut = new ShareBillSplitService(splits, shares, token, encryption);
  });

  it('mints a token and persists the hashed + encrypted share for the tenant', async () => {
    splits.getMeta.mockResolvedValue({ id: 'split-1', invoiceId: 'inv-1' });
    token.generate.mockReturnValue('raw-token');
    token.hash.mockReturnValue('hashed-token');
    encryption.encrypt.mockResolvedValue('enc-token');
    shares.create.mockResolvedValue('share-1');

    const result = await sut.createShare('tenant-1', 'split-1');

    expect(result.token).toBe('raw-token');
    expect(result.shareId).toBe('share-1');
    expect(typeof result.expiresAt).toBe('string');
    expect(shares.create).toHaveBeenCalledWith(
      expect.objectContaining({
        splitId: 'split-1',
        createdByUserId: 'tenant-1',
        tokenHash: 'hashed-token',
        tokenEnc: 'enc-token',
      }),
    );
  });

  it('throws BillSplitNotFoundError when the split is not visible to the tenant', async () => {
    splits.getMeta.mockResolvedValue(null);

    await expect(sut.createShare('tenant-1', 'ghost')).rejects.toBeInstanceOf(BillSplitNotFoundError);
    expect(shares.create).not.toHaveBeenCalled();
  });

  it('resolves a valid token to its split + tenant', async () => {
    token.hash.mockReturnValue('hashed-token');
    shares.resolve.mockResolvedValue({ splitId: 'split-1', tenantId: 'tenant-1' });

    const resolved = await sut.resolveShare('raw-token');

    expect(shares.resolve).toHaveBeenCalledWith('hashed-token');
    expect(resolved).toEqual({ splitId: 'split-1', tenantId: 'tenant-1' });
  });

  it('throws InvalidShareError for an unknown, revoked, or expired token', async () => {
    token.hash.mockReturnValue('hashed-token');
    shares.resolve.mockResolvedValue(null);

    await expect(sut.resolveShare('raw-token')).rejects.toBeInstanceOf(InvalidShareError);
  });
});
