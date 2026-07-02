import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { RequestExportService } from '@core/services/gdpr/RequestExportService';
import type { IDataRequestRepository } from '@core/ports/gdpr/IDataRequestRepository';
import type { IExportQueue } from '@core/ports/gdpr/IExportQueue';
import { ExportRateLimitedError } from '@core/domain/errors';

describe('RequestExportService', () => {
  let requests: MockedObject<IDataRequestRepository>;
  let queue: MockedObject<IExportQueue>;
  let sut: RequestExportService;

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
    queue = { enqueue: vi.fn() };
    sut = new RequestExportService(requests, queue);
  });

  it('rejects a new request when one was already made in the last 24h', async () => {
    requests.hasRecentExportRequest.mockResolvedValue(true);

    await expect(sut.request('tenant-1')).rejects.toBeInstanceOf(ExportRateLimitedError);
    expect(requests.hasRecentExportRequest).toHaveBeenCalledWith('tenant-1', 24);
    expect(requests.createExportRequest).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('creates a request and enqueues it when no recent request exists', async () => {
    requests.hasRecentExportRequest.mockResolvedValue(false);
    requests.createExportRequest.mockResolvedValue('req-1');

    const result = await sut.request('tenant-1');

    expect(result).toEqual({ requestId: 'req-1' });
    expect(queue.enqueue).toHaveBeenCalledWith({ requestId: 'req-1', tenantId: 'tenant-1' });
  });

  it('acquires the tenant export lock before checking the rate limit, serializing concurrent requests', async () => {
    const order: string[] = [];
    requests.acquireExportLock.mockImplementation(async () => { order.push('lock'); });
    requests.hasRecentExportRequest.mockImplementation(async () => { order.push('check'); return false; });
    requests.createExportRequest.mockResolvedValue('req-1');

    await sut.request('tenant-1');

    expect(requests.acquireExportLock).toHaveBeenCalledWith('tenant-1');
    expect(order).toEqual(['lock', 'check']);
  });
});
