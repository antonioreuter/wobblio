export interface IngestionMessage {
  invoiceId: string;
  tenantId: string;
  s3Key: string;
}

export interface IIngestionQueue {
  enqueue(message: IngestionMessage): Promise<void>;
}
