import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { IAnalyticsQueuePort, FunnelEvent } from '@core/ports/notifications/IAnalyticsQueuePort';

export class SqsAnalyticsQueueAdapter implements IAnalyticsQueuePort {
  private readonly client: SQSClient;

  constructor(region: string, private readonly queueUrl: string) {
    this.client = new SQSClient({ region });
  }

  async enqueue(event: FunnelEvent): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({ event, ts: Date.now() }),
      }),
    );
  }
}
