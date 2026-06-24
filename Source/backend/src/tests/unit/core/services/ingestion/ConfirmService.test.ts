import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ConfirmService } from '@core/services/ingestion/ConfirmService';
import type { IInvoiceRepository, InvoiceRecord } from '@core/ports/ingestion/IInvoiceRepository';
import type { IS3FileStorage } from '@core/ports/ingestion/IS3FileStorage';
import type { IIngestionQueue } from '@core/ports/ingestion/IIngestionQueue';
import { InvoiceNotFoundError, OversizeUploadError, StaleUploadError } from '@core/domain/errors';

const record: InvoiceRecord = {
  id: 'inv-1',
  tenantId: 'tenant-1',
  status: 'PROCESSING',
  imageS3Key: 'receipts/tenant-1/abc.jpg',
  imageSha256: 'abc',
  householdId: null,
};

const pdfRecord: InvoiceRecord = { ...record, imageS3Key: 'receipts/tenant-1/abc.pdf' };

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
    storage = { presignPut: vi.fn(), presignGet: vi.fn(), headObject: vi.fn(), getObjectBytes: vi.fn(), deleteObject: vi.fn() };
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
    storage.headObject.mockResolvedValue({ exists: false, size: 0 });

    await expect(sut.confirm('inv-1', 'tenant-1')).rejects.toBeInstanceOf(StaleUploadError);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues the ingestion message when the upload exists', async () => {
    invoiceRepo.getById.mockResolvedValue(record);
    storage.headObject.mockResolvedValue({ exists: true, size: 800_000 });

    await sut.confirm('inv-1', 'tenant-1');

    expect(queue.enqueue).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      tenantId: 'tenant-1',
      s3Key: 'receipts/tenant-1/abc.jpg',
    });
  });

  it('rejects an oversize PDF with OversizeUploadError', async () => {
    invoiceRepo.getById.mockResolvedValue(pdfRecord);
    storage.headObject.mockResolvedValue({ exists: true, size: 5_000_000 });

    await expect(sut.confirm('inv-1', 'tenant-1')).rejects.toBeInstanceOf(OversizeUploadError);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues a within-limit PDF upload', async () => {
    invoiceRepo.getById.mockResolvedValue(pdfRecord);
    storage.headObject.mockResolvedValue({ exists: true, size: 2_000_000 });

    await sut.confirm('inv-1', 'tenant-1');

    expect(queue.enqueue).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      tenantId: 'tenant-1',
      s3Key: 'receipts/tenant-1/abc.pdf',
    });
  });
});
