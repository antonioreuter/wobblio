import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ShoppingListShareService } from '@core/services/lists/ShoppingListShareService';
import type { IShoppingListRepository, ListDetail } from '@core/ports/lists/IShoppingListRepository';
import type { IShoppingListShareRepository } from '@core/ports/lists/IShoppingListShareRepository';
import type { ISecureToken } from '@core/ports/security/ISecureToken';
import type { IKmsEncryption } from '@core/ports/security/IKmsEncryption';
import { ListNotFoundError, InvalidListShareError } from '@core/domain/errors';

const detail: ListDetail = {
  id: 'l1', name: 'Groceries', categoryId: 'cat-groceries', regionCode: null, countryCode: null,
  isActive: true, createdAt: '', completedAt: null, items: [],
};

describe('ShoppingListShareService', () => {
  let lists: MockedObject<IShoppingListRepository>;
  let shares: MockedObject<IShoppingListShareRepository>;
  let token: MockedObject<ISecureToken>;
  let encryption: MockedObject<IKmsEncryption>;
  let sut: ShoppingListShareService;

  beforeEach(() => {
    lists = {
      countActive: vi.fn(), create: vi.fn(), listActive: vi.fn(), getDetail: vi.fn(),
      addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn(), complete: vi.fn(), setRegion: vi.fn(),
    };
    shares = { create: vi.fn(), resolve: vi.fn(), revoke: vi.fn() };
    token = { generate: vi.fn(), hash: vi.fn() };
    encryption = { encrypt: vi.fn(), decrypt: vi.fn() };
    sut = new ShoppingListShareService(lists, shares, token, encryption);
  });

  it('mints a token and persists the hashed + encrypted share for the list', async () => {
    lists.getDetail.mockResolvedValue(detail);
    token.generate.mockReturnValue('raw-token');
    token.hash.mockReturnValue('hashed-token');
    encryption.encrypt.mockResolvedValue('enc-token');
    shares.create.mockResolvedValue('share-1');

    const result = await sut.createShare('tenant-1', 'l1');

    expect(result.token).toBe('raw-token');
    expect(result.shareId).toBe('share-1');
    expect(typeof result.expiresAt).toBe('string');
    expect(shares.create).toHaveBeenCalledWith(
      expect.objectContaining({
        listId: 'l1',
        createdByUserId: 'tenant-1',
        tokenHash: 'hashed-token',
        tokenEnc: 'enc-token',
      }),
    );
  });

  it('throws ListNotFoundError when the list is not visible to the tenant', async () => {
    lists.getDetail.mockResolvedValue(null);

    await expect(sut.createShare('tenant-1', 'ghost')).rejects.toBeInstanceOf(ListNotFoundError);
    expect(shares.create).not.toHaveBeenCalled();
  });

  it('revokes an open share', async () => {
    shares.revoke.mockResolvedValue(true);
    await sut.revokeShare('l1', 'share-1');
    expect(shares.revoke).toHaveBeenCalledWith('l1', 'share-1');
  });

  it('throws InvalidListShareError revoking an unknown or already-revoked share', async () => {
    shares.revoke.mockResolvedValue(false);
    await expect(sut.revokeShare('l1', 'ghost')).rejects.toBeInstanceOf(InvalidListShareError);
  });

  it('resolves a valid token to its list + tenant', async () => {
    token.hash.mockReturnValue('hashed-token');
    shares.resolve.mockResolvedValue({ listId: 'l1', tenantId: 'tenant-1' });

    const resolved = await sut.resolveShare('raw-token');

    expect(shares.resolve).toHaveBeenCalledWith('hashed-token');
    expect(resolved).toEqual({ listId: 'l1', tenantId: 'tenant-1' });
  });

  it('throws InvalidListShareError for an unknown, revoked, or expired token', async () => {
    token.hash.mockReturnValue('hashed-token');
    shares.resolve.mockResolvedValue(null);

    await expect(sut.resolveShare('raw-token')).rejects.toBeInstanceOf(InvalidListShareError);
  });
});
