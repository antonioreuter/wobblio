import type { IDataRetentionRepository } from '../../ports/maintenance/IDataRetentionRepository';

export class UnknownRetentionResourceError extends Error {
  constructor(resource: string) {
    super(`Unknown retention resource: ${resource}`);
    this.name = 'UnknownRetentionResourceError';
  }
}

export interface RetentionOutcome {
  resource: string;
  deleted: number;
}

export class DataRetentionService {
  constructor(private readonly repo: IDataRetentionRepository) {}

  async purge(resource: string): Promise<RetentionOutcome> {
    const deleted = await this.dispatchPurge(resource);
    return { resource, deleted };
  }

  private async dispatchPurge(resource: string): Promise<number> {
    switch (resource) {
      case 'notification':
        return this.repo.purgeExpiredNotifications();
      case 'invoice_share':
        return this.repo.purgeExpiredInvoiceShares();
      case 'household_invite':
        return this.repo.purgeExpiredHouseholdInvites();
      case 'ingestion_ledger':
        return this.repo.purgeOldIngestionLedger();
      case 'quota_counter':
        return this.repo.purgeOldQuotaCounters();
      case 'weekly_advisor':
        return this.repo.purgeStaleWeeklyAdvisors();
      case 'stuck_invoice':
        return this.repo.failStuckInvoices();
      default:
        throw new UnknownRetentionResourceError(resource);
    }
  }
}
