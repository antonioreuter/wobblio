import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { AdminFaultService } from '@core/services/admin/AdminFaultService';
import type { IFaultAdminRepository, BlockedInvoice } from '@core/ports/ingestion/IFaultAdminRepository';
import type { IIngestionQueue } from '@core/ports/ingestion/IIngestionQueue';
import type { INotificationRepository } from '@core/ports/notifications/INotificationRepository';
import type { IPushNotifier } from '@core/ports/notifications/IPushNotifier';
import type { IAdminAuditLog } from '@core/ports/admin/IAdminAuditLog';
import type { ISystemFaultLimitsProvider } from '@core/ports/quota/ISystemFaultLimitsProvider';

const ACTOR = { id: 'admin-1', email: 'admin@wobblio.nl' };
// Wednesday 2026-06-24 → week start Monday 2026-06-22.
const NOW = () => new Date('2026-06-24T10:00:00Z');

const blocked = (invoiceId: string, blockedAt: string): BlockedInvoice => ({
  invoiceId,
  ownerId: `owner-${invoiceId}`,
  systemFaultReason: '[23514] location_source check',
  imageS3Key: `receipts/owner-${invoiceId}/${invoiceId}.jpg`,
  blockedAt,
});

describe('AdminFaultService', () => {
  let faults: MockedObject<IFaultAdminRepository>;
  let queue: MockedObject<IIngestionQueue>;
  let notifications: MockedObject<INotificationRepository>;
  let push: MockedObject<IPushNotifier>;
  let audit: MockedObject<IAdminAuditLog>;
  let limits: MockedObject<ISystemFaultLimitsProvider>;
  let sut: AdminFaultService;

  beforeEach(() => {
    faults = { listBlocked: vi.fn(), reprocess: vi.fn(), wontProcess: vi.fn() };
    queue = { enqueue: vi.fn() };
    notifications = { create: vi.fn(), listActive: vi.fn(), markRead: vi.fn(), purgeExpired: vi.fn() };
    push = { push: vi.fn() };
    audit = { record: vi.fn(), list: vi.fn() };
    limits = { getMaxSystemFaultsPerWeek: vi.fn().mockResolvedValue(3) };
    sut = new AdminFaultService(faults, queue, notifications, push, audit, limits, NOW);
  });

  describe('listBlocked', () => {
    it('counts only this-week faults, flags at/over threshold, and never leaks the S3 key', async () => {
      faults.listBlocked.mockResolvedValue([
        blocked('a', '2026-06-23 09:00:00+00'), // this week
        blocked('b', '2026-06-22 00:00:00+00'), // this week (week start)
        blocked('c', '2026-06-20 09:00:00+00'), // last week
      ]);
      limits.getMaxSystemFaultsPerWeek.mockResolvedValue(2); // exactly the count → at threshold

      const view = await sut.listBlocked();

      expect(view.invoices).toHaveLength(3);
      expect(view.thisWeekCount).toBe(2);
      expect(view.threshold).toBe(2);
      expect(view.overThreshold).toBe(true); // >= threshold fires AT the limit
      // The tenant-encoding S3 key must never reach the client (§08 GDPR control).
      expect(view.invoices.every((i) => !('imageS3Key' in i))).toBe(true);
      expect(audit.record).not.toHaveBeenCalled(); // reads are never audited
    });

    it('is not over threshold when this-week count is below the limit', async () => {
      faults.listBlocked.mockResolvedValue([blocked('a', '2026-06-23 09:00:00+00')]);
      limits.getMaxSystemFaultsPerWeek.mockResolvedValue(3);

      const view = await sut.listBlocked();
      expect(view.thisWeekCount).toBe(1);
      expect(view.overThreshold).toBe(false);
    });

    it('defaults the clock to the system time when none is injected', async () => {
      const svc = new AdminFaultService(faults, queue, notifications, push, audit, limits);
      faults.listBlocked.mockResolvedValue([]);
      await expect(svc.listBlocked()).resolves.toMatchObject({ thisWeekCount: 0 });
    });
  });

  describe('reprocess', () => {
    it('re-enqueues the stored file with reprocess=true and audits each, skipping unblocked', async () => {
      faults.reprocess.mockImplementation(async (id) =>
        id === 'gone' ? null : { tenantId: `t-${id}`, s3Key: `k-${id}` },
      );

      const result = await sut.reprocess(ACTOR, ['a', 'gone', 'b']);

      expect(result).toEqual({ reprocessed: 2, skipped: 1 });
      expect(queue.enqueue).toHaveBeenCalledWith({ invoiceId: 'a', tenantId: 't-a', s3Key: 'k-a', reprocess: true });
      expect(queue.enqueue).toHaveBeenCalledTimes(2);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'fault.reprocess', target: 'a' }));
      expect(audit.record).toHaveBeenCalledTimes(2);
    });

    it('does not enqueue or audit an invoice that is no longer quarantined', async () => {
      faults.reprocess.mockResolvedValue(null);
      const result = await sut.reprocess(ACTOR, ['gone']);
      expect(result).toEqual({ reprocessed: 0, skipped: 1 });
      expect(queue.enqueue).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('isolates a failing invoice (counts it skipped) and continues the batch', async () => {
      faults.reprocess.mockImplementation(async (id) => ({ tenantId: `t-${id}`, s3Key: `k-${id}` }));
      // Enqueue throws for the first id only; the second must still go through.
      queue.enqueue.mockRejectedValueOnce(new Error('SQS throttled'));

      const result = await sut.reprocess(ACTOR, ['boom', 'ok']);

      expect(result).toEqual({ reprocessed: 1, skipped: 1 });
      expect(queue.enqueue).toHaveBeenCalledTimes(2);
      expect(audit.record).toHaveBeenCalledTimes(1); // only the successful one is audited
    });
  });

  describe('wontProcess', () => {
    it('demotes, notifies the owner, and audits', async () => {
      faults.wontProcess.mockResolvedValue({ tenantId: 't-1' });

      const result = await sut.wontProcess(ACTOR, 'inv-1');

      expect(result).toEqual({ demoted: true });
      expect(faults.wontProcess).toHaveBeenCalledWith('inv-1', 'UNPROCESSABLE');
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't-1', kind: 'invoice_unprocessable' }));
      expect(push.push).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'fault.wont_process', target: 'inv-1' }));
    });

    it('is a no-op when the invoice is not (any longer) quarantined', async () => {
      faults.wontProcess.mockResolvedValue(null);
      const result = await sut.wontProcess(ACTOR, 'inv-1');
      expect(result).toEqual({ demoted: false });
      expect(notifications.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('still succeeds when the best-effort notification fails', async () => {
      faults.wontProcess.mockResolvedValue({ tenantId: 't-1' });
      notifications.create.mockRejectedValue(new Error('ses down'));

      await expect(sut.wontProcess(ACTOR, 'inv-1')).resolves.toEqual({ demoted: true });
      expect(audit.record).toHaveBeenCalled();
    });
  });
});
