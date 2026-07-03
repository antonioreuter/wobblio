import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ExportWorkerService } from '@core/services/gdpr/ExportWorkerService';
import type { IDataRequestRepository, DataRequestRecord } from '@core/ports/gdpr/IDataRequestRepository';
import type { IExportDataSource, ExportAccount } from '@core/ports/gdpr/IExportDataSource';
import type { IS3FileStorage } from '@core/ports/ingestion/IS3FileStorage';
import type { IArchiveUploader } from '@core/ports/gdpr/IArchiveUploader';
import type { IZipArchiver, ArchiveEntry } from '@core/ports/admin/IZipArchiver';
import { DataRequestNotFoundError } from '@core/domain/errors';

const account: ExportAccount = {
  fullName: 'Anne Vos',
  email: 'anne@example.nl',
  country: 'NL',
  language: 'nl',
  currency: 'EUR',
  createdAt: '2026-01-01T00:00:00.000Z',
  priceContributionOptout: false,
};

const pendingRequest: DataRequestRecord = {
  id: 'req-1',
  tenantId: 'tenant-1',
  status: 'PENDING',
  exportS3Key: null,
  requestedAt: '2026-06-10T00:00:00.000Z',
  completedAt: null,
};

function makeStorage(): MockedObject<IS3FileStorage> {
  return { presignPost: vi.fn(), presignGet: vi.fn(), headObject: vi.fn(), getObjectBytes: vi.fn(), deleteObject: vi.fn() };
}

describe('ExportWorkerService', () => {
  let requests: MockedObject<IDataRequestRepository>;
  let dataSource: MockedObject<IExportDataSource>;
  let uploadsStorage: MockedObject<IS3FileStorage>;
  let exportsStorage: MockedObject<IArchiveUploader>;
  let zipper: MockedObject<IZipArchiver>;
  let sut: ExportWorkerService;

  beforeEach(() => {
    requests = {
      acquireExportLock: vi.fn(),
      hasRecentExportRequest: vi.fn(),
      createExportRequest: vi.fn(),
      claimForProcessing: vi.fn().mockResolvedValue(true),
      getExportById: vi.fn(),
      getLatestExport: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    };
    dataSource = {
      getAccount: vi.fn().mockResolvedValue(account),
      listInvoices: vi.fn().mockResolvedValue([{ id: 'inv-1' }]),
      listInvoiceLines: vi.fn().mockResolvedValue([{ id: 'line-1' }]),
      listShoppingLists: vi.fn().mockResolvedValue([{ id: 'list-1' }]),
      listBudgets: vi.fn().mockResolvedValue([{ id: 'budget-1' }]),
      listReceiptImageKeys: vi.fn().mockResolvedValue([{ invoiceId: 'inv-1', imageS3Key: 'receipts/tenant-1/inv-1.jpg' }]),
    };
    uploadsStorage = makeStorage();
    exportsStorage = { putObject: vi.fn() };
    zipper = { archive: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) };
    uploadsStorage.getObjectBytes.mockResolvedValue(new Uint8Array([9]));
    requests.getExportById.mockResolvedValue(pendingRequest);

    sut = new ExportWorkerService(requests, dataSource, uploadsStorage, exportsStorage, zipper);
  });

  it('throws DataRequestNotFoundError for an unknown request', async () => {
    requests.getExportById.mockResolvedValue(null);
    await expect(sut.run('ghost', 'tenant-1')).rejects.toBeInstanceOf(DataRequestNotFoundError);
  });

  it('short-circuits as a no-op when the request is already COMPLETED (idempotent redelivery)', async () => {
    requests.getExportById.mockResolvedValue({ ...pendingRequest, status: 'COMPLETED' });
    requests.claimForProcessing.mockResolvedValue(false);

    const result = await sut.run('req-1', 'tenant-1');

    expect(result).toBeNull();
    expect(dataSource.getAccount).not.toHaveBeenCalled();
    expect(zipper.archive).not.toHaveBeenCalled();
  });

  it('short-circuits as a no-op when a concurrent invocation already claimed it (already PROCESSING)', async () => {
    // getExportById still shows PENDING (read before the other invocation's claim commits its
    // own view) but claimForProcessing loses the atomic race — must still no-op, not reprocess.
    requests.claimForProcessing.mockResolvedValue(false);

    const result = await sut.run('req-1', 'tenant-1');

    expect(result).toBeNull();
    expect(dataSource.getAccount).not.toHaveBeenCalled();
    expect(zipper.archive).not.toHaveBeenCalled();
  });

  it('claims the request (PENDING/FAILED -> PROCESSING) before doing any work', async () => {
    await sut.run('req-1', 'tenant-1');
    expect(requests.claimForProcessing).toHaveBeenCalledWith('req-1');
  });

  it('writes a header-less CSV (just the newline) for a table with zero rows', async () => {
    dataSource.listBudgets.mockResolvedValue([]);

    await sut.run('req-1', 'tenant-1');

    const entries: ArchiveEntry[] = zipper.archive.mock.calls[0][0];
    const budgetsCsv = entries.find((e) => e.name === 'budgets.csv')!;
    expect(new TextDecoder().decode(budgetsCsv.bytes)).toBe('');
    const budgetsJson = entries.find((e) => e.name === 'budgets.json')!;
    expect(JSON.parse(new TextDecoder().decode(budgetsJson.bytes))).toEqual([]);
  });

  it('builds all 5 table entries plus receipts, uploads the zip, and marks completed', async () => {
    const result = await sut.run('req-1', 'tenant-1');

    const entries: ArchiveEntry[] = zipper.archive.mock.calls[0][0];
    const names = entries.map((e) => e.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'account.json',
        'invoices.json', 'invoices.csv',
        'invoice_lines.json', 'invoice_lines.csv',
        'shopping_lists.json', 'shopping_lists.csv',
        'budgets.json', 'budgets.csv',
        'receipts/inv-1.jpeg',
      ]),
    );
    expect(exportsStorage.putObject).toHaveBeenCalledWith('tenant-1/req-1.zip', new Uint8Array([1, 2, 3]), 'application/zip');
    expect(requests.markCompleted).toHaveBeenCalledWith('req-1', 'tenant-1/req-1.zip');
    expect(result).toEqual({ s3Key: 'tenant-1/req-1.zip', email: account.email });
  });

  it('tolerates one missing/expired receipt image without failing the whole export', async () => {
    dataSource.listReceiptImageKeys.mockResolvedValue([
      { invoiceId: 'inv-1', imageS3Key: 'receipts/tenant-1/inv-1.jpg' },
      { invoiceId: 'inv-2', imageS3Key: 'receipts/tenant-1/inv-2.jpg' },
    ]);
    uploadsStorage.getObjectBytes
      .mockResolvedValueOnce(new Uint8Array([9]))
      .mockRejectedValueOnce(new Error('NoSuchKey'));

    const result = await sut.run('req-1', 'tenant-1');

    const entries: ArchiveEntry[] = zipper.archive.mock.calls[0][0];
    const receiptNames = entries.map((e) => e.name).filter((n) => n.startsWith('receipts/'));
    expect(receiptNames).toEqual(['receipts/inv-1.jpeg']);
    expect(result).not.toBeNull();
    expect(requests.markCompleted).toHaveBeenCalled();
  });

  it('never marks completed if the zip upload fails', async () => {
    exportsStorage.putObject.mockRejectedValue(new Error('s3 down'));

    await expect(sut.run('req-1', 'tenant-1')).rejects.toThrow('s3 down');
    expect(requests.markCompleted).not.toHaveBeenCalled();
  });
});
