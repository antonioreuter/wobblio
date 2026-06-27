import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { DataRetentionService, UnknownRetentionResourceError } from '@core/services/maintenance/DataRetentionService';
import type { IDataRetentionRepository } from '@core/ports/maintenance/IDataRetentionRepository';

describe('DataRetentionService', () => {
  let repo: MockedObject<IDataRetentionRepository>;
  let sut: DataRetentionService;

  beforeEach(() => {
    repo = {
      purgeExpiredNotifications: vi.fn().mockResolvedValue(5),
      purgeExpiredInvoiceShares: vi.fn().mockResolvedValue(3),
      purgeExpiredHouseholdInvites: vi.fn().mockResolvedValue(2),
      purgeOldIngestionLedger: vi.fn().mockResolvedValue(10),
      purgeOldQuotaCounters: vi.fn().mockResolvedValue(7),
      purgeStaleWeeklyAdvisors: vi.fn().mockResolvedValue(1),
      failStuckInvoices: vi.fn().mockResolvedValue(4),
    };
    sut = new DataRetentionService(repo);
  });

  it('dispatches notification purge', async () => {
    const outcome = await sut.purge('notification');

    expect(outcome).toEqual({ resource: 'notification', deleted: 5 });
    expect(repo.purgeExpiredNotifications).toHaveBeenCalledTimes(1);
  });

  it('dispatches invoice_share purge', async () => {
    const outcome = await sut.purge('invoice_share');

    expect(outcome).toEqual({ resource: 'invoice_share', deleted: 3 });
    expect(repo.purgeExpiredInvoiceShares).toHaveBeenCalledTimes(1);
  });

  it('dispatches household_invite purge', async () => {
    const outcome = await sut.purge('household_invite');

    expect(outcome).toEqual({ resource: 'household_invite', deleted: 2 });
    expect(repo.purgeExpiredHouseholdInvites).toHaveBeenCalledTimes(1);
  });

  it('dispatches ingestion_ledger purge', async () => {
    const outcome = await sut.purge('ingestion_ledger');

    expect(outcome).toEqual({ resource: 'ingestion_ledger', deleted: 10 });
    expect(repo.purgeOldIngestionLedger).toHaveBeenCalledTimes(1);
  });

  it('dispatches quota_counter purge', async () => {
    const outcome = await sut.purge('quota_counter');

    expect(outcome).toEqual({ resource: 'quota_counter', deleted: 7 });
    expect(repo.purgeOldQuotaCounters).toHaveBeenCalledTimes(1);
  });

  it('dispatches weekly_advisor purge', async () => {
    const outcome = await sut.purge('weekly_advisor');

    expect(outcome).toEqual({ resource: 'weekly_advisor', deleted: 1 });
    expect(repo.purgeStaleWeeklyAdvisors).toHaveBeenCalledTimes(1);
  });

  it('dispatches stuck_invoice reaper', async () => {
    const outcome = await sut.purge('stuck_invoice');

    expect(outcome).toEqual({ resource: 'stuck_invoice', deleted: 4 });
    expect(repo.failStuckInvoices).toHaveBeenCalledTimes(1);
  });

  it('throws UnknownRetentionResourceError for unknown resource', async () => {
    await expect(sut.purge('unknown_table')).rejects.toThrow(UnknownRetentionResourceError);
  });
});
