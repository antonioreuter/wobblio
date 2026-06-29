import type { IFaultAdminRepository, BlockedInvoice } from '../../ports/ingestion/IFaultAdminRepository';
import type { IIngestionQueue } from '../../ports/ingestion/IIngestionQueue';
import type { INotificationRepository } from '../../ports/notifications/INotificationRepository';
import type { IPushNotifier } from '../../ports/notifications/IPushNotifier';
import type { IAdminAuditLog, AdminActor } from '../../ports/admin/IAdminAuditLog';
import type { ISystemFaultLimitsProvider } from '../../ports/quota/ISystemFaultLimitsProvider';
import { friendlyFailureMessage } from '../../domain/failureReasons';
import { weekStart } from '../../domain/week';

// Client-safe view of a quarantined invoice: the tenant-encoding S3 key is dropped (it
// must stay server-side — §08 GDPR control). Only the debug-sample service, which fetches
// bytes server-side, reads the key (off the repo, never the HTTP response).
export type FaultListItem = Omit<BlockedInvoice, 'imageS3Key'>;

// The faults list plus the §07.4 alert-only signal (no hard guard): how many invoices were
// quarantined this week vs the SSM threshold.
export interface BlockedFaultsView {
  invoices: FaultListItem[];
  thisWeekCount: number;
  threshold: number;
  overThreshold: boolean;
}

// Operator reprocess-on-behalf (§07): list quarantined invoices, re-run them from the stored
// S3 file, or demote a hopeless one to a deletable user-fault. All cross-tenant work is in
// the SECURITY DEFINER repo; this service is the orchestration + audit + notify.
export class AdminFaultService {
  constructor(
    private readonly faults: IFaultAdminRepository,
    private readonly queue: IIngestionQueue,
    private readonly notifications: INotificationRepository,
    private readonly push: IPushNotifier,
    private readonly audit: IAdminAuditLog,
    private readonly limits: ISystemFaultLimitsProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // Read — never audited (Locked decision #1: reads are not audit events). The
  // tenant-encoding S3 key is stripped before it leaves the server (§08 GDPR control).
  async listBlocked(): Promise<BlockedFaultsView> {
    const blocked = await this.faults.listBlocked();
    const week = weekStart(this.now().toISOString().slice(0, 10));
    const thisWeekCount = blocked.filter((i) => i.blockedAt.slice(0, 10) >= week).length;
    const threshold = await this.limits.getMaxSystemFaultsPerWeek();
    const invoices: FaultListItem[] = blocked.map((i) => ({
      invoiceId: i.invoiceId,
      ownerId: i.ownerId,
      systemFaultReason: i.systemFaultReason,
      blockedAt: i.blockedAt,
    }));
    return { invoices, thisWeekCount, threshold, overThreshold: thisWeekCount >= threshold };
  }

  // Re-run each selected invoice from its stored file: the SD call releases the ledger +
  // resets to PROCESSING + clears the quarantine, then we re-enqueue with reprocess=true so
  // the worker charges the run and notifies on success. Skips any that are no longer blocked.
  async reprocess(actor: AdminActor, invoiceIds: string[]): Promise<{ reprocessed: number; skipped: number }> {
    let reprocessed = 0;
    for (const invoiceId of invoiceIds) {
      // Per-invoice isolation: one failure (no longer blocked, or an enqueue error) must not
      // abort the batch. A rare enqueue-after-reset failure strands the invoice in PROCESSING;
      // the data-retention reaper (fail_stuck_invoices) recovers it to a deletable FAILED.
      try {
        const target = await this.faults.reprocess(invoiceId);
        if (!target) continue;
        await this.queue.enqueue({ invoiceId, tenantId: target.tenantId, s3Key: target.s3Key, reprocess: true });
        await this.audit.record({
          actorUserId: actor.id, actorEmail: actor.email, action: 'fault.reprocess', target: invoiceId,
        });
        reprocessed += 1;
      } catch {
        // counted as skipped below; the operator retries from the (still-listed) faults view.
      }
    }
    return { reprocessed, skipped: invoiceIds.length - reprocessed };
  }

  // Demote a hopeless invoice to a deletable user-fault (UNPROCESSABLE) and tell the owner.
  async wontProcess(actor: AdminActor, invoiceId: string): Promise<{ demoted: boolean }> {
    const result = await this.faults.wontProcess(invoiceId, 'UNPROCESSABLE');
    if (!result) return { demoted: false };
    await this.notifyUnprocessable(result.tenantId);
    await this.audit.record({
      actorUserId: actor.id, actorEmail: actor.email, action: 'fault.wont_process', target: invoiceId,
    });
    return { demoted: true };
  }

  // Best-effort: the demotion already committed, so a notification failure must not fail the
  // operator action (matches the IPushNotifier best-effort contract).
  private async notifyUnprocessable(tenantId: string): Promise<void> {
    const title = "We couldn't process your receipt";
    const body = friendlyFailureMessage('UNPROCESSABLE');
    try {
      await this.notifications.create({ tenantId, kind: 'invoice_unprocessable', title, body, budgetId: null, ttlDays: 7 });
      await this.push.push(tenantId, title, body);
    } catch {
      // swallow — the user-fault demotion is the source of truth; the notify is advisory.
    }
  }
}
