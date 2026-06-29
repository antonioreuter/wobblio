import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { AdminDebugSampleService } from '@core/services/admin/AdminDebugSampleService';
import type { IFaultAdminRepository, BlockedInvoice } from '@core/ports/ingestion/IFaultAdminRepository';
import type { IS3FileStorage } from '@core/ports/ingestion/IS3FileStorage';
import type { IZipArchiver } from '@core/ports/admin/IZipArchiver';
import type { IAdminAuditLog } from '@core/ports/admin/IAdminAuditLog';

const ACTOR = { id: 'admin-1', email: 'admin@wobblio.nl' };
const REASON = '[23514] location_source check';

const blocked = (invoiceId: string, reason: string, ext = 'jpg'): BlockedInvoice => ({
  invoiceId,
  ownerId: `owner-${invoiceId}`,
  systemFaultReason: reason,
  imageS3Key: `receipts/owner-${invoiceId}/${invoiceId}.${ext}`,
  blockedAt: '2026-06-28 09:00:00+00',
});

describe('AdminDebugSampleService', () => {
  let faults: MockedObject<IFaultAdminRepository>;
  let storage: MockedObject<IS3FileStorage>;
  let zipper: MockedObject<IZipArchiver>;
  let audit: MockedObject<IAdminAuditLog>;
  let sut: AdminDebugSampleService;

  beforeEach(() => {
    faults = { listBlocked: vi.fn(), reprocess: vi.fn(), wontProcess: vi.fn() };
    storage = { presignPost: vi.fn(), presignGet: vi.fn(), headObject: vi.fn(), getObjectBytes: vi.fn(), deleteObject: vi.fn() };
    zipper = { archive: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) };
    audit = { record: vi.fn(), list: vi.fn() };
    storage.getObjectBytes.mockImplementation(async (key: string) => new TextEncoder().encode(key));
    sut = new AdminDebugSampleService(faults, storage, zipper, audit);
  });

  it('caps to 2 samples per root cause and names them opaquely (no key/path/tenant)', async () => {
    faults.listBlocked.mockResolvedValue([
      blocked('a', REASON),
      blocked('b', REASON, 'png'),
      blocked('c', REASON), // third match — excluded by the cap
      blocked('d', 'other reason'), // different reason — excluded
    ]);

    const { count } = await sut.buildSample(ACTOR, REASON);

    expect(count).toBe(2);
    const entries = zipper.archive.mock.calls[0][0];
    expect(entries.map((e) => e.name)).toEqual(['sample-1.jpeg', 'sample-2.png']);
    // No entry name reveals the tenant-encoding key/path.
    expect(entries.every((e) => !e.name.includes('owner-') && !e.name.includes('receipts/'))).toBe(true);
  });

  it('fetches the bytes server-side for each matched invoice', async () => {
    faults.listBlocked.mockResolvedValue([blocked('a', REASON)]);
    await sut.buildSample(ACTOR, REASON);
    expect(storage.getObjectBytes).toHaveBeenCalledWith('receipts/owner-a/a.jpg');
  });

  it('audits actor + reason + count, never the tenant', async () => {
    faults.listBlocked.mockResolvedValue([blocked('a', REASON)]);
    await sut.buildSample(ACTOR, REASON);
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      actorEmail: 'admin@wobblio.nl',
      action: 'fault.debug_sample',
      target: REASON,
      after: { count: 1 },
    });
  });

  it('returns an empty sample (count 0) when no invoice matches the reason', async () => {
    faults.listBlocked.mockResolvedValue([blocked('a', 'other')]);
    const { count } = await sut.buildSample(ACTOR, REASON);
    expect(count).toBe(0);
    expect(storage.getObjectBytes).not.toHaveBeenCalled();
  });

  it('skips a missing object rather than failing the whole sample', async () => {
    faults.listBlocked.mockResolvedValue([blocked('a', REASON), blocked('b', REASON, 'png')]);
    storage.getObjectBytes.mockReset();
    storage.getObjectBytes
      .mockRejectedValueOnce(new Error('NoSuchKey'))
      .mockResolvedValueOnce(new Uint8Array([9]));

    const { count } = await sut.buildSample(ACTOR, REASON);

    expect(count).toBe(1);
    const entries = zipper.archive.mock.calls[0][0];
    expect(entries.map((e) => e.name)).toEqual(['sample-1.png']); // contiguous naming
  });
});
