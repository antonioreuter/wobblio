/**
 * Local SQS → worker bridge — dev only.
 *
 * On AWS the ingestion queue drives the worker via an SQS event source. Locally
 * we long-poll the LocalStack queue and invoke the REAL worker handler, so the
 * end-to-end path (confirm → SQS → worker → Bedrock vision parse → DB) runs the
 * same code as production.
 */
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import type { SQSEvent, Context } from 'aws-lambda';
import { handler as ingestionWorker } from '@handlers/agentic-worker';

// Local mirror of the SQS event-source maxConcurrency: run this many worker loops in
// parallel so a burst of uploads parses concurrently. Override with LOCAL_POLLER_CONCURRENCY.
const DEFAULT_CONCURRENCY = 10;

export function startIngestionPoller(): void {
  const queueUrl = process.env.INGEST_QUEUE_URL;
  if (!queueUrl) {
    console.log('[local-poller] INGEST_QUEUE_URL not set; ingestion poller disabled');
    return;
  }

  const client = new SQSClient({});
  const concurrency = Number(process.env.LOCAL_POLLER_CONCURRENCY) || DEFAULT_CONCURRENCY;

  const loop = async (): Promise<void> => {
    for (;;) {
      try {
        const received = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 10,
            // So the worker's final-delivery quarantine gate sees the real redelivery count.
            MessageSystemAttributeNames: ['ApproximateReceiveCount'],
          }),
        );
        for (const message of received.Messages ?? []) {
          const event = {
            Records: [{
              messageId: message.MessageId,
              body: message.Body,
              receiptHandle: message.ReceiptHandle,
              // The worker reads record.attributes (SentTimestamp timing log + ApproximateReceiveCount
              // quarantine gate); real SQS always supplies them. Without these the worker throws
              // post-commit and the message is needlessly redelivered before it's deleted.
              attributes: {
                SentTimestamp: String(Date.now()),
                ApproximateReceiveCount: String(message.Attributes?.ApproximateReceiveCount ?? '1'),
              },
            }],
          } as unknown as SQSEvent;
          const result = await ingestionWorker(event, {} as Context);
          const failed = result.batchItemFailures.some(f => f.itemIdentifier === message.MessageId);
          if (!failed) {
            await client.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle }));
          }
        }
      } catch (err) {
        console.error('[local-poller] error', err);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  };

  for (let i = 0; i < concurrency; i++) void loop();
  console.log(`[local-poller] polling ${queueUrl} (${concurrency} concurrent workers)`);
}
