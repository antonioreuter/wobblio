export interface IIngestionLedger {
  // INSERT ... ON CONFLICT DO NOTHING — returns true only on the first delivery
  // for this s3_key (transport idempotency). false => duplicate delivery.
  claim(s3Key: string, tenantId: string): Promise<boolean>;
  setStatus(s3Key: string, status: string): Promise<void>;
}
