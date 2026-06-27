export interface IDataRetentionRepository {
  purgeExpiredNotifications(): Promise<number>;
  purgeExpiredInvoiceShares(): Promise<number>;
  purgeExpiredHouseholdInvites(): Promise<number>;
  purgeOldIngestionLedger(): Promise<number>;
  purgeOldQuotaCounters(): Promise<number>;
  purgeStaleWeeklyAdvisors(): Promise<number>;
  // Flip invoices stuck in PROCESSING past the worker's retry budget to the terminal
  // FAILED_PROCESSING so they surface as failed and become deletable.
  failStuckInvoices(): Promise<number>;
}
