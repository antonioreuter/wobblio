import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ShareInvoiceService } from '@core/services/ingestion/ShareInvoiceService';
import type { IInvoiceRepository, InvoiceDetail } from '@core/ports/ingestion/IInvoiceRepository';
import type { IInvoiceShareRepository } from '@core/ports/ingestion/IInvoiceShareRepository';
import type { ISecureToken } from '@core/ports/security/ISecureToken';
import type { IKmsEncryption } from '@core/ports/security/IKmsEncryption';
import { InvoiceNotFoundError, InvalidShareError } from '@core/domain/errors';

const detail: InvoiceDetail = {
  id: 'inv-1',
  status: 'PARSED',
  merchantName: 'Albert Heijn',
  categoryId: 'cat-groceries',
  transactionDate: '2026-06-10',
  total: 42.5,
  currency: 'EUR',
  searchTags: [],
  createdAt: '2026-06-10T10:00:00Z',
  locationStatus: 'RESOLVED',
  locationCountryCode: 'NL',
  locationRegionCode: 'NL-NB',
  imageS3Key: 'receipts/tenant-1/abc.jpg',
  lines: [],
};

describe('ShareInvoiceService', () => {
  let invoices: MockedObject<IInvoiceRepository>;
  let shares: MockedObject<IInvoiceShareRepository>;
  let token: MockedObject<ISecureToken>;
  let encryption: MockedObject<IKmsEncryption>;
  let sut: ShareInvoiceService;

  beforeEach(() => {
    invoices = { getDetail: vi.fn() } as unknown as MockedObject<IInvoiceRepository>;
    shares = { create: vi.fn(), resolve: vi.fn() };
    token = { generate: vi.fn(), hash: vi.fn() };
    encryption = { encrypt: vi.fn(), decrypt: vi.fn() };
    sut = new ShareInvoiceService(invoices, shares, token, encryption);
  });

  it('mints a token and persists the hashed + encrypted share for the tenant', async () => {
    invoices.getDetail.mockResolvedValue(detail);
    token.generate.mockReturnValue('raw-token');
    token.hash.mockReturnValue('hashed-token');
    encryption.encrypt.mockResolvedValue('enc-token');
    shares.create.mockResolvedValue('share-1');

    const result = await sut.createShare('tenant-1', 'inv-1');

    expect(result.token).toBe('raw-token');
    expect(result.shareId).toBe('share-1');
    expect(typeof result.expiresAt).toBe('string');
    expect(shares.create).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: 'inv-1',
        createdByUserId: 'tenant-1',
        tokenHash: 'hashed-token',
        tokenEnc: 'enc-token',
      }),
    );
  });

  it('throws InvoiceNotFoundError when the invoice is not visible to the tenant', async () => {
    invoices.getDetail.mockResolvedValue(null);

    await expect(sut.createShare('tenant-1', 'ghost')).rejects.toBeInstanceOf(InvoiceNotFoundError);
    expect(shares.create).not.toHaveBeenCalled();
  });

  it('resolves a valid token to its invoice + tenant', async () => {
    token.hash.mockReturnValue('hashed-token');
    shares.resolve.mockResolvedValue({ invoiceId: 'inv-1', tenantId: 'tenant-1' });

    const resolved = await sut.resolveShare('raw-token');

    expect(shares.resolve).toHaveBeenCalledWith('hashed-token');
    expect(resolved).toEqual({ invoiceId: 'inv-1', tenantId: 'tenant-1' });
  });

  it('throws InvalidShareError for an unknown, revoked, or expired token', async () => {
    token.hash.mockReturnValue('hashed-token');
    shares.resolve.mockResolvedValue(null);

    await expect(sut.resolveShare('raw-token')).rejects.toBeInstanceOf(InvalidShareError);
  });
});
