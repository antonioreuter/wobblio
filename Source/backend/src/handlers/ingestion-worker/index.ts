import type { SQSEvent, SQSBatchResponse, Context } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';
import { IngestionLedgerAdapter } from '@infrastructure/adapters/ingestion/IngestionLedgerAdapter';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { S3FileStorageAdapter } from '@infrastructure/adapters/ingestion/S3FileStorageAdapter';
import { AiSpendLedgerAdapter } from '@infrastructure/adapters/ai/AiSpendLedgerAdapter';
import { SsmSpendCapAdapter } from '@infrastructure/adapters/ai/SsmSpendCapAdapter';
import { BedrockConverseAdapter } from '@infrastructure/adapters/ai/BedrockConverseAdapter';
import { BedrockTitanEmbedderAdapter } from '@infrastructure/adapters/data-intelligence/BedrockTitanEmbedderAdapter';
import { MerchantCatalogAdapter } from '@infrastructure/adapters/data-intelligence/MerchantCatalogAdapter';
import { ProductCatalogAdapter } from '@infrastructure/adapters/data-intelligence/ProductCatalogAdapter';
import { PriceObservationStoreAdapter } from '@infrastructure/adapters/data-intelligence/PriceObservationStoreAdapter';
import { ContributorContextRepositoryAdapter } from '@infrastructure/adapters/data-intelligence/ContributorContextRepositoryAdapter';
import { RegionReferenceAdapter } from '@infrastructure/adapters/data-intelligence/RegionReferenceAdapter';
import { BedrockSpendGuardService } from '@core/services/ai/BedrockSpendGuardService';
import { VisionParseService } from '@core/services/ingestion/VisionParseService';
import { MerchantResolver } from '@core/services/data-intelligence/MerchantResolver';
import { ProductNormalizer } from '@core/services/data-intelligence/ProductNormalizer';
import { InvoiceClassifier } from '@core/services/data-intelligence/InvoiceClassifier';
import { TagGenerator } from '@core/services/data-intelligence/TagGenerator';
import { IngestionService } from '@core/services/ingestion/IngestionService';
import { BudgetRecyclerRepositoryAdapter } from '@infrastructure/adapters/budgets/BudgetRecyclerRepositoryAdapter';
import { NotificationRepositoryAdapter } from '@infrastructure/adapters/notifications/NotificationRepositoryAdapter';
import { MockPushAdapter } from '@infrastructure/adapters/notifications/MockPushAdapter';
import { BudgetRecyclerService } from '@core/services/budgets/BudgetRecyclerService';
import type { IngestionMessage } from '@core/ports/ingestion/IIngestionQueue';
import { VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION } from '../../prompts/visionParse';

// Budgets a freshly-parsed invoice can move; only PARSED/NEEDS_REVIEW invoices count.
const COUNTS_TOWARD_BUDGET = new Set(['PARSED', 'NEEDS_REVIEW']);

const REGION = process.env.AWS_REGION ?? 'eu-west-1';
const VISION_MODEL_PARAM = '/wobblio/config/models/vision_parser';
const AUXILIARY_MODEL_PARAM = '/wobblio/config/models/auxiliary';
const EMBEDDER_MODEL_PARAM = '/wobblio/config/models/embedder';

const modelIdCache = new Map<string, string>();

async function resolveModelId(param: string): Promise<string> {
  const cached = modelIdCache.get(param);
  if (cached) return cached;
  const ssm = new SSMClient({ region: REGION });
  const response = await ssm.send(new GetParameterCommand({ Name: param }));
  const value = response.Parameter?.Value ?? '';
  if (!value) throw new Error(`SSM parameter ${param} is missing`);
  modelIdCache.set(param, value);
  return value;
}

export const handler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
  const log = createLambdaLogger('ingestion-worker', context.awsRequestId);
  const pool = await buildPool(process.env.DB_SECRET_ARN!, process.env.DB_HOST!, process.env.DB_PORT!);
  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  const visionModelId = await resolveModelId(VISION_MODEL_PARAM);
  const auxiliaryModelId = await resolveModelId(AUXILIARY_MODEL_PARAM);
  const embedderModelId = await resolveModelId(EMBEDDER_MODEL_PARAM);
  const converse = new BedrockConverseAdapter(REGION);
  const embedder = new BedrockTitanEmbedderAdapter(REGION, embedderModelId);
  const capProvider = new SsmSpendCapAdapter(REGION);

  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    const workerStart = Date.now();
    const client = await pool.connect();
    try {
      const message = JSON.parse(record.body) as IngestionMessage;
      await client.query('BEGIN');

      const spendGuard = new BedrockSpendGuardService(converse, new AiSpendLedgerAdapter(client), capProvider);
      const visionParser = new VisionParseService(spendGuard, visionModelId, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION);
      const merchantCatalog = new MerchantCatalogAdapter(client);
      const productCatalog = new ProductCatalogAdapter(client);
      const service = new IngestionService(
        new TenantContextAdapter(client),
        new IngestionLedgerAdapter(client),
        new S3FileStorageAdapter(REGION, uploadsBucket),
        visionParser,
        new MerchantResolver(merchantCatalog, spendGuard, auxiliaryModelId),
        new ProductNormalizer(productCatalog, embedder, spendGuard, auxiliaryModelId),
        new InvoiceClassifier(merchantCatalog, spendGuard, auxiliaryModelId),
        new TagGenerator(),
        new InvoiceRepositoryAdapter(client),
        new PriceObservationStoreAdapter(client),
        new ContributorContextRepositoryAdapter(client),
        new RegionReferenceAdapter(client),
      );

      const outcome = await service.process(message);
      await client.query('COMMIT');
      log.info('ingestion processed', {
        invoiceId: message.invoiceId,
        handled: outcome.handled,
        status: outcome.status,
      });

      // End-to-end processing time, rolled up daily into kpi_daily via Logs Insights.
      // Skip duplicate SQS deliveries (handled:false) — they did no real work.
      if (outcome.handled) {
        const workerMs = Date.now() - workerStart;
        const sentTimestamp = Number(record.attributes.SentTimestamp);
        const totalMs = Number.isFinite(sentTimestamp) ? Date.now() - sentTimestamp : workerMs;
        log.info('ingestion timing', {
          invoiceId: message.invoiceId,
          status: outcome.status,
          totalMs,
          workerMs,
          queueWaitMs: totalMs - workerMs,
        });
      }
      if (outcome.receipt) {
        log.debug('parsed receipt', { invoiceId: message.invoiceId, receipt: outcome.receipt });
      }

      // Fire 85%/100% budget alerts at upload time. Best-effort: a failure here must
      // never roll back or retry the (already committed) ingestion.
      if (outcome.handled && outcome.status && COUNTS_TOWARD_BUDGET.has(outcome.status)) {
        try {
          const budgetAlerts = new BudgetRecyclerService(
            new BudgetRecyclerRepositoryAdapter(pool),
            new NotificationRepositoryAdapter(pool),
            new MockPushAdapter(),
          );
          const today = new Date().toISOString().slice(0, 10);
          const { alertsFired } = await budgetAlerts.evaluateForInvoice(message.invoiceId, today);
          if (alertsFired > 0) log.info('budget alerts fired', { invoiceId: message.invoiceId, alertsFired });
        } catch (alertErr) {
          log.error('budget alert evaluation failed', {
            invoiceId: message.invoiceId,
            err: alertErr instanceof Error ? alertErr : new Error(String(alertErr)),
          });
        }
      }
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      const cause = (err as { cause?: unknown }).cause;
      log.error('ingestion failed', {
        messageId: record.messageId,
        err: err instanceof Error ? err : new Error(String(err)),
        cause: cause instanceof Error ? cause : cause ? new Error(String(cause)) : undefined,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    } finally {
      client.release();
    }
  }

  return { batchItemFailures };
};
