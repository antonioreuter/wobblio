import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SqsInvoiceIngestionQueueAdapter } from '@infrastructure/adapters/ingestion/SqsInvoiceIngestionQueueAdapter';
import { SQSClient } from '@aws-sdk/client-sqs';

const QUEUE_URL = 'https://sqs.eu-west-1.amazonaws.com/0/agentic';

describe('SqsInvoiceIngestionQueueAdapter', () => {
  let adapter: SqsInvoiceIngestionQueueAdapter;
  let sqsSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    adapter = new SqsInvoiceIngestionQueueAdapter('eu-west-1', QUEUE_URL);
    sqsSpy = vi.spyOn(SQSClient.prototype, 'send' as never);
    sqsSpy.mockResolvedValue(undefined as never);
  });

  const sentTo = (): string => (sqsSpy.mock.calls[0][0] as { input: { QueueUrl: string } }).input.QueueUrl;
  const sentBody = (): string => (sqsSpy.mock.calls[0][0] as { input: { MessageBody: string } }).input.MessageBody;

  it('sends the invoice message to the configured queue', async () => {
    await adapter.enqueue('inv-1', 'tenant-1', 'receipts/tenant-1/abc.jpg');

    expect(sentTo()).toBe(QUEUE_URL);
    expect(JSON.parse(sentBody())).toEqual({
      invoiceId: 'inv-1',
      tenantId: 'tenant-1',
      s3Key: 'receipts/tenant-1/abc.jpg',
    });
    expect(sqsSpy).toHaveBeenCalledTimes(1);
  });
});
