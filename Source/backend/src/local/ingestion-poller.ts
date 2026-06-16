/**
 * Local SQS → worker bridge — dev only.
 *
 * On AWS the ingestion queue drives the worker via an SQS event source. Locally
 * we long-poll the LocalStack queue and invoke the REAL worker handler, so the
 * end-to-end path (confirm → SQS → worker → Ollama vision parse → DB) runs the
 * same code as production.
 */
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import type { SQSEvent, Context } from 'aws-lambda';
import { handler as ingestionWorker } from '@handlers/ingestion-worker';

export function startIngestionPoller(): void {
  const queueUrl = process.env.INGEST_QUEUE_URL;
  if (!queueUrl) {
    console.log('[local-poller] INGEST_QUEUE_URL not set; ingestion poller disabled');
    return;
  }

  const client = new SQSClient({});

  const loop = async (): Promise<void> => {
    for (;;) {
      try {
        const received = await client.send(
          new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: 1, WaitTimeSeconds: 10 }),
        );
        for (const message of received.Messages ?? []) {
          const event = {
            Records: [{ messageId: message.MessageId, body: message.Body, receiptHandle: message.ReceiptHandle }],
          } as unknown as SQSEvent;
          const result = await ingestionWorker(event, {} as Context);
          const failed = result.batchItemFailures.some(f => f.itemIdentifier === message.MessageId);
          if (!failed) {
            await client.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle }));
          }
        }
      } catch (err) {
        console.error('[local-poller] error', (err as Error).message);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  };

  void loop();
  console.log(`[local-poller] polling ${queueUrl}`);
}
