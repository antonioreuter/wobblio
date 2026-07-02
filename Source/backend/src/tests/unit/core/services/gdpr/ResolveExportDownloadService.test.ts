import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ResolveExportDownloadService } from '@core/services/gdpr/ResolveExportDownloadService';
import type { IDataRequestRepository, DataRequestRecord } from '@core/ports/gdpr/IDataRequestRepository';
import type { IS3FileStorage } from '@core/ports/ingestion/IS3FileStorage';
import { DataRequestNotFoundError } from '@core/domain/errors';

const record = (overrides: Partial<DataRequestRecord> = {}): DataRequestRecord => ({
  id: 'req-1',
  tenantId: 'tenant-1',
  status: 'COMPLETED',
  exportS3Key: 'tenant-1/req-1.zip',
  requestedAt: '2026-06-10T00:00:00.000Z',
  completedAt: '2026-06-10T00:05:00.000Z',
  ...overrides,
});

describe('ResolveExportDownloadService', () => {
  let requests: MockedObject<IDataRequestRepository>;
  let storage: MockedObject<IS3FileStorage>;
  let sut: ResolveExportDownloadService;

  beforeEach(() => {
    requests = {
      acquireExportLock: vi.fn(),
      hasRecentExportRequest: vi.fn(),
      createExportRequest: vi.fn(),
      claimForProcessing: vi.fn(),
      getExportById: vi.fn(),
      getLatestExport: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    };
    storage = { presignPost: vi.fn(), presignGet: vi.fn(), headObject: vi.fn(), getObjectBytes: vi.fn(), deleteObject: vi.fn() };
    sut = new ResolveExportDownloadService(requests, storage);
  });

  it('throws DataRequestNotFoundError for an unknown (or cross-tenant) id', async () => {
    requests.getExportById.mockResolvedValue(null);
    await expect(sut.resolve('ghost')).rejects.toBeInstanceOf(DataRequestNotFoundError);
  });

  it.each(['PENDING', 'PROCESSING', 'FAILED'] as const)('returns %s status with no url', async (status) => {
    requests.getExportById.mockResolvedValue(record({ status, exportS3Key: null }));
    const result = await sut.resolve('req-1');
    expect(result).toEqual({ status, downloadUrl: null });
    expect(storage.headObject).not.toHaveBeenCalled();
  });

  it('returns EXPIRED when COMPLETED but the object is gone (past the 7-day lifecycle rule)', async () => {
    requests.getExportById.mockResolvedValue(record());
    storage.headObject.mockResolvedValue({ exists: false, size: 0 });

    const result = await sut.resolve('req-1');

    expect(result).toEqual({ status: 'EXPIRED', downloadUrl: null });
    expect(storage.presignGet).not.toHaveBeenCalled();
  });

  it('mints a fresh 300s presigned url every call when COMPLETED and the object exists', async () => {
    requests.getExportById.mockResolvedValue(record());
    storage.headObject.mockResolvedValue({ exists: true, size: 1234 });
    storage.presignGet.mockResolvedValue('https://s3/fresh-1');

    const first = await sut.resolve('req-1');
    storage.presignGet.mockResolvedValue('https://s3/fresh-2');
    const second = await sut.resolve('req-1');

    expect(first).toEqual({ status: 'COMPLETED', downloadUrl: 'https://s3/fresh-1' });
    expect(second).toEqual({ status: 'COMPLETED', downloadUrl: 'https://s3/fresh-2' });
    expect(storage.presignGet).toHaveBeenCalledWith('tenant-1/req-1.zip', 300);
    expect(storage.presignGet).toHaveBeenCalledTimes(2);
  });
});
