import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { PresignService } from '@core/services/PresignService';
import { QuotaService } from '@core/services/QuotaService';
import type { IInvoiceRepository, InvoiceRecord } from '@core/ports/IInvoiceRepository';
import type { IQuotaRepository } from '@core/ports/IQuotaRepository';
import type { IUploadQuotaProvider } from '@core/ports/IUploadQuotaProvider';
import type { IS3FileStorage } from '@core/ports/IS3FileStorage';
import { DuplicateInvoiceError, QuotaExceededError } from '@core/domain/errors';

const SHA = 'a'.repeat(64);

const baseInput = {
  tenantId: 'tenant-1',
  uploadedByUserId: 'tenant-1',
  role: 'STANDARD' as const,
  householdId: null,
  imageSha256: SHA,
  contentType: 'image/jpeg',
};

describe('PresignService', () => {
  let invoiceRepo: MockedObject<IInvoiceRepository>;
  let quotaRepo: MockedObject<IQuotaRepository>;
  let quotaProvider: MockedObject<IUploadQuotaProvider>;
  let storage: MockedObject<IS3FileStorage>;
  let sut: PresignService;

  beforeEach(() => {
    invoiceRepo = {
      createPending: vi.fn(),
      getById: vi.fn(),
      findSameTenantByHash: vi.fn(),
      findFuzzyDuplicate: vi.fn(),
      persistParsed: vi.fn(),
      updateStatus: vi.fn(),
      listForTenant: vi.fn(),
      getDetail: vi.fn(),
    };
    quotaRepo = { getUsed: vi.fn(), increment: vi.fn() };
    quotaProvider = { getPersonalUploadsCap: vi.fn(), getHouseholdUploadsCap: vi.fn() };
    storage = { presignPut: vi.fn(), presignGet: vi.fn(), headExists: vi.fn(), getObjectBytes: vi.fn() };
    sut = new PresignService(invoiceRepo, new QuotaService(quotaRepo), quotaProvider, storage);
  });

  it('rejects a same-tenant duplicate without touching quota or creating an invoice', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue({ id: 'inv-old' } as InvoiceRecord);

    await expect(sut.presign(baseInput)).rejects.toBeInstanceOf(DuplicateInvoiceError);
    expect(invoiceRepo.createPending).not.toHaveBeenCalled();
    expect(quotaRepo.increment).not.toHaveBeenCalled();
  });

  it('issues a presigned URL for a personal upload and reserves the personal quota', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue(null);
    quotaProvider.getPersonalUploadsCap.mockResolvedValue(3);
    quotaRepo.getUsed.mockResolvedValue(0);
    invoiceRepo.createPending.mockResolvedValue('inv-1');
    storage.presignPut.mockResolvedValue('https://s3/put');

    const result = await sut.presign(baseInput);

    expect(result).toEqual({ invoiceId: 'inv-1', uploadUrl: 'https://s3/put', s3Key: `receipts/tenant-1/${SHA}.jpg` });
    expect(quotaProvider.getPersonalUploadsCap).toHaveBeenCalledWith('STANDARD');
    expect(quotaRepo.increment).toHaveBeenCalledWith('tenant-1', 'UPLOADS', expect.any(String));
    expect(storage.presignPut).toHaveBeenCalledWith(`receipts/tenant-1/${SHA}.jpg`, 'image/jpeg', 300);
  });

  it('reserves the household pool when a householdId is provided', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue(null);
    quotaProvider.getHouseholdUploadsCap.mockResolvedValue(20);
    quotaRepo.getUsed.mockResolvedValue(5);
    invoiceRepo.createPending.mockResolvedValue('inv-2');
    storage.presignPut.mockResolvedValue('https://s3/put');

    await sut.presign({ ...baseInput, householdId: 'hh-1' });

    expect(quotaProvider.getHouseholdUploadsCap).toHaveBeenCalled();
    expect(quotaRepo.increment).toHaveBeenCalledWith('tenant-1', 'HOUSEHOLD_UPLOADS', expect.any(String));
  });

  it('throws QuotaExceededError when the cap is reached', async () => {
    invoiceRepo.findSameTenantByHash.mockResolvedValue(null);
    quotaProvider.getPersonalUploadsCap.mockResolvedValue(3);
    quotaRepo.getUsed.mockResolvedValue(3);

    await expect(sut.presign(baseInput)).rejects.toBeInstanceOf(QuotaExceededError);
    expect(invoiceRepo.createPending).not.toHaveBeenCalled();
  });
});
