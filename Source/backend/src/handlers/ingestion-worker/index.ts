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
import { buildConverseAdapter } from '@infrastructure/adapters/ai/converseFactory';
import { buildEmbedderAdapter } from '@infrastructure/adapters/data-intelligence/embedderFactory';
import { MerchantCatalogAdapter } from '@infrastructure/adapters/data-intelligence/MerchantCatalogAdapter';
import { ProductCatalogAdapter } from '@infrastructure/adapters/data-intelligence/ProductCatalogAdapter';
import { PriceObservationStoreAdapter } from '@infrastructure/adapters/data-intelligence/PriceObservationStoreAdapter';
import { ContributorContextRepositoryAdapter } from '@infrastructure/adapters/data-intelligence/ContributorContextRepositoryAdapter';
import { BedrockSpendGuardService } from '@core/services/ai/BedrockSpendGuardService';
import { VisionParseService } from '@core/services/ingestion/VisionParseService';
import { MerchantResolver } from '@core/services/data-intelligence/MerchantResolver';
import { ProductNormalizer } from '@core/services/data-intelligence/ProductNormalizer';
import { InvoiceClassifier } from '@core/services/data-intelligence/InvoiceClassifier';
import { TagGenerator } from '@core/services/data-intelligence/TagGenerator';
import { IngestionService } from '@core/services/ingestion/IngestionService';
import type { IngestionMessage } from '@core/ports/ingestion/IIngestionQueue';
import { VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION } from '../../prompts/visionParse';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';
const VISION_MODEL_PARAM = '/wobblio/config/models/vision_parser';
const AUXILIARY_MODEL_PARAM = '/wobblio/config/models/auxiliary';
const EMBEDDER_MODEL_PARAM = '/wobblio/config/models/embedder';

const modelIdCache = new Map<string, string>();

async function resolveModelId(param: string, localFallback: string): Promise<string> {
  const cached = modelIdCache.get(param);
  if (cached) return cached;
  if (process.env.STAGE === 'local') {
    modelIdCache.set(param, localFallback);
    return localFallback;
  }
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
  const localChatModel = process.env.OLLAMA_MODEL ?? 'gemma4:31b-it-qat';
  const visionModelId = await resolveModelId(VISION_MODEL_PARAM, localChatModel);
  const auxiliaryModelId = await resolveModelId(AUXILIARY_MODEL_PARAM, localChatModel);
  const embedderModelId = await resolveModelId(EMBEDDER_MODEL_PARAM, 'mock-embedder-model');
  const converse = buildConverseAdapter(REGION);
  const embedder = buildEmbedderAdapter(REGION, embedderModelId);
  const capProvider = new SsmSpendCapAdapter(REGION);

  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
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
      );

      const outcome = await service.process(message);
      await client.query('COMMIT');
      log.info('ingestion processed', {
        invoiceId: message.invoiceId,
        handled: outcome.handled,
        status: outcome.status,
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      log.error('ingestion failed', { messageId: record.messageId, error: (err as Error).message });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    } finally {
      client.release();
    }
  }

  return { batchItemFailures };
};
