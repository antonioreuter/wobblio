import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ConfirmService } from '@core/services/ingestion/ConfirmService';
import type { IInvoiceRepository, InvoiceRecord } from '@core/ports/ingestion/IInvoiceRepository';
import type { IS3FileStorage } from '@core/ports/ingestion/IS3FileStorage';
import type { IIngestionQueue } from '@core/ports/ingestion/IIngestionQueue';
import { InvoiceNotFoundError, StaleUploadError } from '@core/domain/errors';

const record: InvoiceRecord = {
  id: 'inv-1',
  tenantId: 'tenant-1',
  status: 'PROCESSING',
  imageS3Key: 'receipts/tenant-1/abc.jpg',
  imageSha256: 'abc',
  householdId: null,
};

describe('ConfirmService', () => {
  let invoiceRepo: MockedObject<IInvoiceRepository>;
  let storage: MockedObject<IS3FileStorage>;
  let queue: MockedObject<IIngestionQueue>;
  let sut: ConfirmService;

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
    queue = { enqueue: vi.fn() };
    sut = new ConfirmService(invoiceRepo, storage, queue);
  });

  it('throws InvoiceNotFoundError for an unknown invoice', async () => {
    invoiceRepo.getById.mockResolvedValue(null);

    await expect(sut.confirm('ghost', 'tenant-1')).rejects.toBeInstanceOf(InvoiceNotFoundError);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('throws StaleUploadError when the S3 object is missing', async () => {
    invoiceRepo.getById.mockResolvedValue(record);
    storage.headExists.mockResolvedValue(false);

    await expect(sut.confirm('inv-1', 'tenant-1')).rejects.toBeInstanceOf(StaleUploadError);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues the ingestion message when the upload exists', async () => {
    invoiceRepo.getById.mockResolvedValue(record);
    storage.headExists.mockResolvedValue(true);

    await sut.confirm('inv-1', 'tenant-1');

    expect(queue.enqueue).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      tenantId: 'tenant-1',
      s3Key: 'receipts/tenant-1/abc.jpg',
    });
  });
});
