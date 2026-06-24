import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SendMessageCommand,
  type Message,
} from '@aws-sdk/client-sqs';
import type { IDeadLetterQueue, DlqMessage } from '@core/ports/ingestion/IDeadLetterQueue';

const PREVIEW_LEN = 200;
const SQS_MAX_BATCH = 10; // hard SQS ReceiveMessage ceiling
// Inspection reads make messages briefly invisible so a concurrent operator action
// doesn't double-handle them; short so a follow-up replay/delete still lands.
const INSPECT_VISIBILITY_SECONDS = 30;

export class SqsDeadLetterQueueAdapter implements IDeadLetterQueue {
  private readonly client: SQSClient;

  constructor(
    region: string,
    private readonly dlqUrl: string,
    private readonly mainQueueUrl: string,
  ) {
    this.client = new SQSClient({ region });
  }

  async list(limit: number): Promise<DlqMessage[]> {
    const messages = await this.receive(limit);
    return messages.map((m) => this.toDlqMessage(m));
  }

  async get(messageId: string): Promise<DlqMessage | null> {
    const messages = await this.receive(SQS_MAX_BATCH);
    const found = messages.find((m) => m.MessageId === messageId);
    return found ? this.toDlqMessage(found) : null;
  }

  async replay(_messageId: string, receiptHandle: string, body: string): Promise<boolean> {
    await this.client.send(new SendMessageCommand({ QueueUrl: this.mainQueueUrl, MessageBody: body }));
    return this.deleteByHandle(receiptHandle);
  }

  async remove(_messageId: string, receiptHandle: string): Promise<boolean> {
    return this.deleteByHandle(receiptHandle);
  }

  async replayAll(limit: number): Promise<number> {
    return this.drain(limit, async (m) => {
      await this.client.send(new SendMessageCommand({ QueueUrl: this.mainQueueUrl, MessageBody: m.Body ?? '' }));
      await this.deleteByHandle(m.ReceiptHandle!);
    });
  }

  async deleteAll(limit: number): Promise<number> {
    return this.drain(limit, async (m) => {
      await this.deleteByHandle(m.ReceiptHandle!);
    });
  }

  private async receive(limit: number): Promise<Message[]> {
    const response = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.dlqUrl,
        MaxNumberOfMessages: Math.min(Math.max(limit, 1), SQS_MAX_BATCH),
        VisibilityTimeout: INSPECT_VISIBILITY_SECONDS,
        WaitTimeSeconds: 1,
        MessageSystemAttributeNames: ['ApproximateReceiveCount', 'SentTimestamp'],
      }),
    );
    return response.Messages ?? [];
  }

  // Receive-and-act in one pass so handles never go stale across calls; loops until
  // the queue is empty or `limit` is reached.
  private async drain(limit: number, act: (m: Message) => Promise<void>): Promise<number> {
    let affected = 0;
    while (affected < limit) {
      const messages = await this.receive(Math.min(limit - affected, SQS_MAX_BATCH));
      if (messages.length === 0) break;
      for (const message of messages) {
        if (affected >= limit) break;
        await act(message);
        affected += 1;
      }
    }
    return affected;
  }

  private async deleteByHandle(receiptHandle: string): Promise<boolean> {
    try {
      await this.client.send(new DeleteMessageCommand({ QueueUrl: this.dlqUrl, ReceiptHandle: receiptHandle }));
      return true;
    } catch {
      return false; // stale/expired handle — message already gone or re-hidden
    }
  }

  private toDlqMessage(message: Message): DlqMessage {
    const body = message.Body ?? '';
    const parsed = parseIngestion(body);
    const sent = message.Attributes?.SentTimestamp;
    return {
      messageId: message.MessageId ?? '',
      receiptHandle: message.ReceiptHandle ?? '',
      body,
      preview: body.length > PREVIEW_LEN ? `${body.slice(0, PREVIEW_LEN)}…` : body,
      tenantId: parsed.tenantId,
      invoiceId: parsed.invoiceId,
      s3Key: parsed.s3Key,
      approximateReceiveCount: Number(message.Attributes?.ApproximateReceiveCount ?? '0'),
      firstFailedAt: sent ? new Date(Number(sent)).toISOString() : null,
    };
  }
}

function parseIngestion(body: string): { tenantId: string | null; invoiceId: string | null; s3Key: string | null } {
  try {
    const m = JSON.parse(body) as Record<string, unknown>;
    return {
      tenantId: typeof m.tenantId === 'string' ? m.tenantId : null,
      invoiceId: typeof m.invoiceId === 'string' ? m.invoiceId : null,
      s3Key: typeof m.s3Key === 'string' ? m.s3Key : null,
    };
  } catch {
    return { tenantId: null, invoiceId: null, s3Key: null };
  }
}
