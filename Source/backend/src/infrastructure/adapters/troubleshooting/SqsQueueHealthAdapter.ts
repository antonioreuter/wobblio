import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import type { IQueueHealthSource, QueueHealth } from '@core/ports/troubleshooting/IQueueHealthSource';

// Snapshots SQS depth for the ingestion queue + its DLQ via GetQueueAttributes.
// Counts are SQS-approximate by definition; good enough for an at-a-glance row.
export class SqsQueueHealthAdapter implements IQueueHealthSource {
  private readonly client: SQSClient;

  constructor(region: string, private readonly queueUrl: string, private readonly dlqUrl: string) {
    this.client = new SQSClient({ region });
  }

  async getHealth(): Promise<QueueHealth> {
    const [main, dlq] = await Promise.all([
      this.attributes(this.queueUrl, ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']),
      this.attributes(this.dlqUrl, ['ApproximateNumberOfMessages']),
    ]);
    return {
      queueDepth: count(main.ApproximateNumberOfMessages),
      inFlight: count(main.ApproximateNumberOfMessagesNotVisible),
      dlqDepth: count(dlq.ApproximateNumberOfMessages),
    };
  }

  private async attributes(queueUrl: string, names: string[]): Promise<Record<string, string>> {
    const res = await this.client.send(
      new GetQueueAttributesCommand({ QueueUrl: queueUrl, AttributeNames: names as never }),
    );
    return res.Attributes ?? {};
  }
}

function count(value: string | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
