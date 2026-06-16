import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { DeleteInvoiceService } from '@core/services/ingestion/DeleteInvoiceService';
import type { IInvoiceRepository, InvoiceRecord } from '@core/ports/ingestion/IInvoiceRepository';
import type { IS3FileStorage } from '@core/ports/ingestion/IS3FileStorage';
import { InvoiceNotFoundError } from '@core/domain/errors';

const record: InvoiceRecord = {
  id: 'inv-1',
  tenantId: 'tenant-1',
  status: 'PARSED',
  imageS3Key: 'receipts/tenant-1/abc.jpg',
  imageSha256: 'abc',
  householdId: null,
};

describe('DeleteInvoiceService', () => {
  let invoiceRepo: MockedObject<IInvoiceRepository>;
  let storage: MockedObject<IS3FileStorage>;
  let sut: DeleteInvoiceService;

  beforeEach(() => {
    invoiceRepo = {
      createPending: vi.fn(),
      getById: vi.fn(),
      findSameTenantByHash: vi.fn(),
      findFuzzyDuplicate: vi.fn(),
      persistParsed: vi.fn(),
      updateStatus: vi.fn(),
      softDelete: vi.fn(),
      listForTenant: vi.fn(),
      getDetail: vi.fn(),
    };
    storage = { presignPut: vi.fn(), presignGet: vi.fn(), headExists: vi.fn(), getObjectBytes: vi.fn(), deleteObject: vi.fn() };
    sut = new DeleteInvoiceService(invoiceRepo, storage);
  });

  it('throws InvoiceNotFoundError for an unknown (or cross-tenant) invoice', async () => {
    invoiceRepo.getById.mockResolvedValue(null);

    await expect(sut.delete('ghost')).rejects.toBeInstanceOf(InvoiceNotFoundError);
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(invoiceRepo.softDelete).not.toHaveBeenCalled();
  });

  it('deletes the S3 photo, then soft-deletes the invoice', async () => {
    invoiceRepo.getById.mockResolvedValue(record);

    await sut.delete('inv-1');

    expect(storage.deleteObject).toHaveBeenCalledWith('receipts/tenant-1/abc.jpg');
    expect(invoiceRepo.softDelete).toHaveBeenCalledWith('inv-1');
  });

  it('leaves the invoice visible if the S3 photo delete fails', async () => {
    invoiceRepo.getById.mockResolvedValue(record);
    storage.deleteObject.mockRejectedValue(new Error('s3 down'));

    await expect(sut.delete('inv-1')).rejects.toThrow('s3 down');
    expect(invoiceRepo.softDelete).not.toHaveBeenCalled();
  });
});
