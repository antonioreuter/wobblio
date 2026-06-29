import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SqsInvoiceIngestionQueueAdapter } from '@infrastructure/adapters/ingestion/SqsInvoiceIngestionQueueAdapter';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SSMClient } from '@aws-sdk/client-ssm';

const LEGACY_URL = 'https://sqs.eu-west-1.amazonaws.com/0/legacy';
const AGENTIC_URL = 'https://sqs.eu-west-1.amazonaws.com/0/agentic';

const FLAG_PARAM = '/wobblio/config/features/agentic_pipeline_enabled';
const AGENTIC_URL_PARAM = '/wobblio/config/queues/agentic_url';

// One GetParameters response with the given flag/url (omit a param to simulate it being absent).
function ssmResponse(flag?: string, agenticUrl?: string) {
  const params = [];
  if (flag !== undefined) params.push({ Name: FLAG_PARAM, Value: flag });
  if (agenticUrl !== undefined) params.push({ Name: AGENTIC_URL_PARAM, Value: agenticUrl });
  return { Parameters: params };
}

describe('SqsInvoiceIngestionQueueAdapter', () => {
  let adapter: SqsInvoiceIngestionQueueAdapter;
  let ssmSpy: ReturnType<typeof vi.spyOn>;
  let sqsSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    adapter = new SqsInvoiceIngestionQueueAdapter('eu-west-1', LEGACY_URL);
    ssmSpy = vi.spyOn(SSMClient.prototype, 'send' as never);
    sqsSpy = vi.spyOn(SQSClient.prototype, 'send' as never);
    sqsSpy.mockResolvedValue(undefined as never);
  });

  const sentTo = (): string => (sqsSpy.mock.calls[0][0] as { input: { QueueUrl: string } }).input.QueueUrl;
  const sentBody = (): string => (sqsSpy.mock.calls[0][0] as { input: { MessageBody: string } }).input.MessageBody;

  it('routes to the agentic queue when the flag is on and the URL is present', async () => {
    ssmSpy.mockResolvedValue(ssmResponse('true', AGENTIC_URL) as never);

    await adapter.enqueue('inv-1', 'tenant-1', 'receipts/tenant-1/abc.jpg');

    expect(sentTo()).toBe(AGENTIC_URL);
    expect(JSON.parse(sentBody())).toEqual({
      invoiceId: 'inv-1',
      tenantId: 'tenant-1',
      s3Key: 'receipts/tenant-1/abc.jpg',
    });
  });

  it('treats "1" as enabled', async () => {
    ssmSpy.mockResolvedValue(ssmResponse('1', AGENTIC_URL) as never);

    await adapter.enqueue('inv-1', 'tenant-1', 'k');

    expect(sentTo()).toBe(AGENTIC_URL);
  });

  it('routes to the legacy queue when the flag is off', async () => {
    ssmSpy.mockResolvedValue(ssmResponse('false', AGENTIC_URL) as never);

    await adapter.enqueue('inv-1', 'tenant-1', 'k');

    expect(sentTo()).toBe(LEGACY_URL);
  });

  it('routes to legacy (never drops) when the SSM read fails', async () => {
    ssmSpy.mockRejectedValue(new Error('ssm down') as never);

    await expect(adapter.enqueue('inv-1', 'tenant-1', 'k')).resolves.toBeUndefined();

    expect(sentTo()).toBe(LEGACY_URL);
  });

  it('routes to legacy when the flag is on but the agentic URL is missing', async () => {
    ssmSpy.mockResolvedValue(ssmResponse('true', undefined) as never);

    await adapter.enqueue('inv-1', 'tenant-1', 'k');

    expect(sentTo()).toBe(LEGACY_URL);
  });

  it('caches the routing read across calls (one SSM fetch per warm container)', async () => {
    ssmSpy.mockResolvedValue(ssmResponse('true', AGENTIC_URL) as never);

    await adapter.enqueue('inv-1', 'tenant-1', 'k');
    await adapter.enqueue('inv-2', 'tenant-1', 'k');

    expect(ssmSpy).toHaveBeenCalledTimes(1);
    expect(sqsSpy).toHaveBeenCalledTimes(2);
  });
});
