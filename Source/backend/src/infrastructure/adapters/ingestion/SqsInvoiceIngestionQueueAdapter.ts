import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { IInvoiceIngestionQueuePort } from '@core/ports/ingestion/IInvoiceIngestionQueuePort';
import type { IngestionMessage } from '@core/ports/ingestion/IIngestionQueue';

// Enqueues a confirmed invoice onto the ingestion queue (the agentic worker's queue — the sole
// ingestion pipeline). The queue URL is injected by the api-handler wiring (AGENTIC_QUEUE_URL).
export class SqsInvoiceIngestionQueueAdapter implements IInvoiceIngestionQueuePort {
  private readonly sqs: SQSClient;

  constructor(region: string, private readonly queueUrl: string) {
    this.sqs = new SQSClient({ region });
  }

  async enqueue(invoiceId: string, tenantId: string, s3Key: string): Promise<void> {
    const message: IngestionMessage = { invoiceId, tenantId, s3Key };
    await this.sqs.send(
      new SendMessageCommand({ QueueUrl: this.queueUrl, MessageBody: JSON.stringify(message) }),
    );
  }
}
