import type { SQSEvent, SQSBatchResponse, Context } from 'aws-lambda';
import type { PoolClient } from 'pg';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { SsmModelRegistryAdapter } from '@infrastructure/adapters/ai/SsmModelRegistryAdapter';
import { buildPool } from '@infrastructure/config/db';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';
import { IngestionLedgerAdapter } from '@infrastructure/adapters/ingestion/IngestionLedgerAdapter';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { S3FileStorageAdapter } from '@infrastructure/adapters/ingestion/S3FileStorageAdapter';
import { BedrockConverseAdapter } from '@infrastructure/adapters/ai/BedrockConverseAdapter';
import { BedrockTitanEmbedderAdapter } from '@infrastructure/adapters/data-intelligence/BedrockTitanEmbedderAdapter';
import { MerchantCatalogAdapter } from '@infrastructure/adapters/data-intelligence/MerchantCatalogAdapter';
import { ProductCatalogAdapter } from '@infrastructure/adapters/data-intelligence/ProductCatalogAdapter';
import { PriceObservationStoreAdapter } from '@infrastructure/adapters/data-intelligence/PriceObservationStoreAdapter';
import { ContributorContextRepositoryAdapter } from '@infrastructure/adapters/data-intelligence/ContributorContextRepositoryAdapter';
import { RegionReferenceAdapter } from '@infrastructure/adapters/data-intelligence/RegionReferenceAdapter';
import { FxRateRepositoryAdapter } from '@infrastructure/adapters/fx/FxRateRepositoryAdapter';
import { VisionParseService } from '@core/services/ingestion/VisionParseService';
import { MerchantResolver } from '@core/services/data-intelligence/MerchantResolver';
import { ProductNormalizer } from '@core/services/data-intelligence/ProductNormalizer';
import { InvoiceClassifier } from '@core/services/data-intelligence/InvoiceClassifier';
import { TagGenerator } from '@core/services/data-intelligence/TagGenerator';
import { IngestionService } from '@core/services/ingestion/IngestionService';
import { SsmUploadQuotaAdapter } from '@infrastructure/adapters/quota/SsmUploadQuotaAdapter';
import { MeteringBedrockConverse } from '@core/services/ai/MeteringBedrockConverse';
import { MeteringBedrockEmbedder } from '@core/services/ai/MeteringBedrockEmbedder';
import type { TokenMeter } from '@core/domain/tokenMeter';
import { runIngestionRecord } from '../shared/ingestionWorkerShell';
import { VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION } from '../../prompts/visionParse';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

// Legacy ingestion pipeline (pipeline_type='LEGACY'). The transaction shell, charging,
// telemetry, and failure handling are shared with the agentic worker (ingestionWorkerShell);
// this handler only wires the LEGACY service — direct, forced-order domain-service calls.
export const handler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
  const log = createLambdaLogger('ingestion-worker', context.awsRequestId);
  const pool = await buildPool(process.env.DB_SECRET_ARN!, process.env.DB_HOST!, process.env.DB_PORT!);
  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  // Model IDs resolve through the canonical registry (admin-console 03) so an admin swap is
  // picked up on the next cold start — no hardcoded IDs. PDFs go to the doc-capable pdf_parser
  // (the vision model rejects document blocks); no fallback, the param must be provisioned.
  const modelRegistry = new SsmModelRegistryAdapter(REGION);
  const visionModelId = await modelRegistry.getModelId('vision_parser');
  const pdfModelId = await modelRegistry.getModelId('pdf_parser');
  const auxiliaryModelId = await modelRegistry.getModelId('auxiliary');
  const embedderModelId = await modelRegistry.getModelId('embedder');
  const converse = new BedrockConverseAdapter(REGION);
  const embedder = new BedrockTitanEmbedderAdapter(REGION, embedderModelId);
  // Per-upload size/page limits for the worker-start validation (§06), cached across records.
  const uploadLimits = new SsmUploadQuotaAdapter(REGION);

  const buildService = (client: PoolClient, meter: TokenMeter): IngestionService => {
    const meteredConverse = new MeteringBedrockConverse(converse, meter);
    const meteredEmbedder = new MeteringBedrockEmbedder(embedder, meter);
    const merchantCatalog = new MerchantCatalogAdapter(client);
    const productCatalog = new ProductCatalogAdapter(client);
    return new IngestionService(
      new TenantContextAdapter(client),
      new IngestionLedgerAdapter(client),
      new S3FileStorageAdapter(REGION, uploadsBucket),
      new VisionParseService(meteredConverse, visionModelId, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION),
      new VisionParseService(meteredConverse, pdfModelId, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION),
      new MerchantResolver(merchantCatalog, meteredConverse, auxiliaryModelId),
      new ProductNormalizer(productCatalog, meteredEmbedder, meteredConverse, auxiliaryModelId),
      new InvoiceClassifier(merchantCatalog, meteredConverse, auxiliaryModelId),
      new TagGenerator(),
      new InvoiceRepositoryAdapter(client),
      new PriceObservationStoreAdapter(client),
      new ContributorContextRepositoryAdapter(client),
      new RegionReferenceAdapter(client),
      uploadLimits,
      new FxRateRepositoryAdapter(client),
    );
  };

  const batchItemFailures: { itemIdentifier: string }[] = [];
  for (const record of event.Records) {
    const workerStart = Date.now();
    const client = await pool.connect();
    try {
      const retry = await runIngestionRecord({ record, client, pool, workerStart, log }, buildService, 'LEGACY');
      if (retry) batchItemFailures.push({ itemIdentifier: record.messageId });
    } finally {
      client.release();
    }
  }

  return { batchItemFailures };
};
