export interface IDataRetentionRepository {
  purgeExpiredNotifications(): Promise<number>;
  purgeExpiredInvoiceShares(): Promise<number>;
  purgeExpiredHouseholdInvites(): Promise<number>;
  purgeOldIngestionLedger(): Promise<number>;
  purgeOldQuotaCounters(): Promise<number>;
  purgeStaleWeeklyAdvisors(): Promise<number>;
}
