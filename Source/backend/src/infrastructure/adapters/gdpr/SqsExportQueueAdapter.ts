import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { IExportQueue, ExportMessage } from '@core/ports/gdpr/IExportQueue';

export class SqsExportQueueAdapter implements IExportQueue {
  private readonly client: SQSClient;

  constructor(region: string, private readonly queueUrl: string) {
    this.client = new SQSClient({ region });
  }

  async enqueue(message: ExportMessage): Promise<void> {
    await this.client.send(
      new SendMessageCommand({ QueueUrl: this.queueUrl, MessageBody: JSON.stringify(message) }),
    );
  }
}
