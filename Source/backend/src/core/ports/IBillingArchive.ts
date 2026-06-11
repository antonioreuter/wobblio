export interface IBillingArchive {
  archiveEventPayload(eventId: string, json: string): Promise<{ s3Key: string }>;
}
