import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { IIngestionQueue, IngestionMessage } from '@core/ports/ingestion/IIngestionQueue';

export class SqsIngestionQueueAdapter implements IIngestionQueue {
  private readonly client: SQSClient;

  constructor(region: string, private readonly queueUrl: string) {
    this.client = new SQSClient({ region });
  }

  async enqueue(message: IngestionMessage): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
      }),
    );
  }
}
