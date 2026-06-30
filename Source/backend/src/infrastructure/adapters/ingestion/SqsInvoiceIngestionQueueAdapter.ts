import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import type { IInvoiceIngestionQueuePort } from '@core/ports/ingestion/IInvoiceIngestionQueuePort';
import type { IngestionMessage } from '@core/ports/ingestion/IIngestionQueue';
import { stageScopeConfig } from '@infrastructure/config/stageConfig';

const FLAG_PARAM = stageScopeConfig('/wobblio/config/features/agentic_pipeline_enabled');
// Written by WobblioDataAiPipelineStack at deploy; absent until that stack is deployed.
const AGENTIC_URL_PARAM = stageScopeConfig('/wobblio/config/queues/agentic_url');

// Confirm is the hot api-handler path (5s timeout, ≤25 concurrency); a per-request SSM call
// risks latency/throttling. Cache the flag + URL per warm container, bounding how stale an
// operator toggle can be before it takes effect. Matches SsmUploadQuotaAdapter's TTL pattern.
const CACHE_TTL_MS = 5 * 60 * 1000;

interface Routing {
  agenticEnabled: boolean;
  agenticUrl: string | null;
}

// Dual-queue routing for confirmed invoices: the agentic queue when the feature flag is on AND
// its URL is known, otherwise the legacy queue. Fail-safe is the inverse of the quota adapter's
// fail-closed — any SSM miss/error routes to legacy so a confirm never throws or drops a message.
export class SqsInvoiceIngestionQueueAdapter implements IInvoiceIngestionQueuePort {
  private readonly sqs: SQSClient;
  private readonly ssm: SSMClient;
  private cache: Routing | null = null;
  private cacheExpiry = 0;

  constructor(region: string, private readonly legacyQueueUrl: string) {
    this.sqs = new SQSClient({ region });
    this.ssm = new SSMClient({ region });
  }

  async enqueue(invoiceId: string, tenantId: string, s3Key: string): Promise<void> {
    const routing = await this.loadRouting();
    const queueUrl =
      routing.agenticEnabled && routing.agenticUrl ? routing.agenticUrl : this.legacyQueueUrl;
    const message: IngestionMessage = { invoiceId, tenantId, s3Key };
    await this.sqs.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(message) }),
    );
  }

  private async loadRouting(): Promise<Routing> {
    if (this.cache && Date.now() < this.cacheExpiry) return this.cache;
    const routing = await this.fetchRouting();
    this.cache = routing;
    this.cacheExpiry = Date.now() + CACHE_TTL_MS;
    return routing;
  }

  // Single batched read of both params. On any SSM failure, return the legacy routing rather
  // than propagating — the message must always be enqueued somewhere.
  private async fetchRouting(): Promise<Routing> {
    try {
      const response = await this.ssm.send(
        new GetParametersCommand({ Names: [FLAG_PARAM, AGENTIC_URL_PARAM] }),
      );
      const values = new Map(
        (response.Parameters ?? []).map((p) => [p.Name, p.Value] as const),
      );
      const flag = values.get(FLAG_PARAM);
      return {
        agenticEnabled: flag === 'true' || flag === '1',
        agenticUrl: values.get(AGENTIC_URL_PARAM) ?? null,
      };
    } catch {
      return { agenticEnabled: false, agenticUrl: null };
    }
  }
}
