import { describe, it, expect, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { mintShareToken } from '@core/domain/shareToken';
import type { ISecureToken } from '@core/ports/security/ISecureToken';
import type { IKmsEncryption } from '@core/ports/security/IKmsEncryption';

describe('mintShareToken', () => {
  it('generates, hashes, and encrypts a raw token, and computes an ISO expiry ttlDays out', async () => {
    const token: MockedObject<ISecureToken> = { generate: vi.fn(), hash: vi.fn() };
    const encryption: MockedObject<IKmsEncryption> = { encrypt: vi.fn(), decrypt: vi.fn() };
    token.generate.mockReturnValue('raw-token');
    token.hash.mockReturnValue('hashed-token');
    encryption.encrypt.mockResolvedValue('enc-token');

    const before = Date.now();
    const minted = await mintShareToken(token, encryption, 7);
    const after = Date.now();

    expect(minted.token).toBe('raw-token');
    expect(minted.tokenHash).toBe('hashed-token');
    expect(minted.tokenEnc).toBe('enc-token');
    expect(encryption.encrypt).toHaveBeenCalledWith('raw-token');
    expect(token.hash).toHaveBeenCalledWith('raw-token');

    const expiresAtMs = Date.parse(minted.expiresAt);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + sevenDaysMs);
    expect(expiresAtMs).toBeLessThanOrEqual(after + sevenDaysMs);
  });
});
