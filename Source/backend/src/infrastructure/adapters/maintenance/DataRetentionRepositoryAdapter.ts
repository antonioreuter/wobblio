import type { Pool, PoolClient } from 'pg';
import type { IDataRetentionRepository } from '@core/ports/maintenance/IDataRetentionRepository';

export class DataRetentionRepositoryAdapter implements IDataRetentionRepository {
  constructor(private readonly pool: Pool | PoolClient) {}

  async purgeExpiredNotifications(): Promise<number> {
    const result = await this.pool.query<{ purge_expired_notifications: number }>(
      `SELECT purge_expired_notifications()`,
    );
    return result.rows[0].purge_expired_notifications;
  }

  async purgeExpiredInvoiceShares(): Promise<number> {
    const result = await this.pool.query<{ purge_expired_invoice_shares: number }>(
      `SELECT purge_expired_invoice_shares()`,
    );
    return result.rows[0].purge_expired_invoice_shares;
  }

  async purgeExpiredHouseholdInvites(): Promise<number> {
    const result = await this.pool.query<{ purge_expired_household_invites: number }>(
      `SELECT purge_expired_household_invites()`,
    );
    return result.rows[0].purge_expired_household_invites;
  }

  async purgeOldIngestionLedger(): Promise<number> {
    const result = await this.pool.query<{ purge_old_ingestion_ledger: number }>(
      `SELECT purge_old_ingestion_ledger()`,
    );
    return result.rows[0].purge_old_ingestion_ledger;
  }

  async purgeOldQuotaCounters(): Promise<number> {
    const result = await this.pool.query<{ purge_old_quota_counters: number }>(
      `SELECT purge_old_quota_counters()`,
    );
    return result.rows[0].purge_old_quota_counters;
  }

  async purgeStaleWeeklyAdvisors(): Promise<number> {
    const result = await this.pool.query<{ purge_stale_weekly_advisors: number }>(
      `SELECT purge_stale_weekly_advisors()`,
    );
    return result.rows[0].purge_stale_weekly_advisors;
  }

  async failStuckInvoices(): Promise<number> {
    const result = await this.pool.query<{ fail_stuck_invoices: number }>(
      `SELECT fail_stuck_invoices()`,
    );
    return result.rows[0].fail_stuck_invoices;
  }
}
