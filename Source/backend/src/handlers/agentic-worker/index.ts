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
import { CurrencyHarmonizationService } from '@core/services/fx/CurrencyHarmonizationService';
import { VisionParseService } from '@core/services/ingestion/VisionParseService';
import { EscalatingReceiptParser } from '@core/services/ingestion/EscalatingReceiptParser';
import { MerchantResolver } from '@core/services/data-intelligence/MerchantResolver';
import { ProductNormalizer } from '@core/services/data-intelligence/ProductNormalizer';
import { InvoiceClassifier } from '@core/services/data-intelligence/InvoiceClassifier';
import { TagGenerator } from '@core/services/data-intelligence/TagGenerator';
import { ExtractionPreparer } from '@core/services/ingestion/ExtractionPreparer';
import { InvoiceFinalizer } from '@core/services/ingestion/InvoiceFinalizer';
import { AgenticIngestionService } from '@core/services/ingestion/AgenticIngestionService';
import { InvoiceCoordinator } from '@core/services/ingestion/agentic/InvoiceCoordinator';
import { StructuredLogAgenticStageInstrumentation } from '@infrastructure/adapters/observability/StructuredLogAgenticStageInstrumentation';
import { OcrParserTool } from '@core/services/ingestion/agentic/tools/OcrParserTool';
import { MerchantResolverTool } from '@core/services/ingestion/agentic/tools/MerchantResolverTool';
import { ProductNormalizerTool } from '@core/services/ingestion/agentic/tools/ProductNormalizerTool';
import { InvoiceClassifierTool } from '@core/services/ingestion/agentic/tools/InvoiceClassifierTool';
import { SearchTagGeneratorTool } from '@core/services/ingestion/agentic/tools/SearchTagGeneratorTool';
import { SsmUploadQuotaAdapter } from '@infrastructure/adapters/quota/SsmUploadQuotaAdapter';
import { MeteringBedrockConverse } from '@core/services/ai/MeteringBedrockConverse';
import { MeteringBedrockEmbedder } from '@core/services/ai/MeteringBedrockEmbedder';
import type { TokenMeter } from '@core/domain/tokenMeter';
import { runIngestionRecord } from '../shared/ingestionWorkerShell';
import { VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION } from '../../prompts/visionParse';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

// Agentic ingestion pipeline (pipeline_type='STRANDS', Non-Functional 01 §3). Shares the
// transaction shell, charging, telemetry, and failure handling with the legacy worker; the
// only difference is the service: a tool-based coordinator (deterministic forced order) over
// the same domain services, between the shared ExtractionPreparer and InvoiceFinalizer.
export const handler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
  const log = createLambdaLogger('agentic-worker', context.awsRequestId);
  const pool = await buildPool(process.env.DB_SECRET_ARN!, process.env.DB_HOST!, process.env.DB_PORT!);
  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  const modelRegistry = new SsmModelRegistryAdapter(REGION);
  const visionModelId = await modelRegistry.getModelId('vision_parser');
  const pdfModelId = await modelRegistry.getModelId('pdf_parser');
  const auxiliaryModelId = await modelRegistry.getModelId('auxiliary');
  const embedderModelId = await modelRegistry.getModelId('embedder');
  // Optional: hard image receipts escalate to this powerful model. Fail-open — unset means off.
  const visionFallbackModelId = await modelRegistry.getModelIdOptional('vision_fallback');
  const converse = new BedrockConverseAdapter(REGION);
  const embedder = new BedrockTitanEmbedderAdapter(REGION, embedderModelId);
  const uploadLimits = new SsmUploadQuotaAdapter(REGION);
  const stageInstrumentation = new StructuredLogAgenticStageInstrumentation();

  const buildService = (client: PoolClient, meter: TokenMeter): AgenticIngestionService => {
    const meteredConverse = new MeteringBedrockConverse(converse, meter);
    const meteredEmbedder = new MeteringBedrockEmbedder(embedder, meter);
    const merchantCatalog = new MerchantCatalogAdapter(client);
    const productCatalog = new ProductCatalogAdapter(client);

    const primaryVision = new VisionParseService(meteredConverse, visionModelId, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION);
    // Wrap the primary parser so hard image receipts re-parse on the powerful fallback model;
    // if no fallback is provisioned, use the primary directly (identical to today's behaviour).
    const visionParser = visionFallbackModelId
      ? new EscalatingReceiptParser(
          primaryVision,
          new VisionParseService(meteredConverse, visionFallbackModelId, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION, 'VISION_PARSE_FALLBACK'),
          undefined,
          (outcome) => log.info('vision parse escalated to fallback', { event: 'vision_escalation', ...outcome }),
        )
      : primaryVision;
    const ocr = new OcrParserTool(
      visionParser,
      new VisionParseService(meteredConverse, pdfModelId, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION),
    );
    const preparer = new ExtractionPreparer(
      new TenantContextAdapter(client),
      new IngestionLedgerAdapter(client),
      new S3FileStorageAdapter(REGION, uploadsBucket),
      new InvoiceRepositoryAdapter(client),
      new ContributorContextRepositoryAdapter(client),
      new RegionReferenceAdapter(client),
      uploadLimits,
      ocr,
    );
    const coordinator = new InvoiceCoordinator(
      new MerchantResolverTool(new MerchantResolver(merchantCatalog, meteredConverse, auxiliaryModelId)),
      new ProductNormalizerTool(new ProductNormalizer(productCatalog, meteredEmbedder, meteredConverse, auxiliaryModelId)),
      new InvoiceClassifierTool(new InvoiceClassifier(merchantCatalog, meteredConverse, auxiliaryModelId)),
      new SearchTagGeneratorTool(new TagGenerator()),
      stageInstrumentation,
    );
    const finalizer = new InvoiceFinalizer(
      new InvoiceRepositoryAdapter(client),
      new PriceObservationStoreAdapter(client),
      new IngestionLedgerAdapter(client),
      new CurrencyHarmonizationService(new FxRateRepositoryAdapter(client)),
    );
    return new AgenticIngestionService(preparer, coordinator, finalizer);
  };

  const batchItemFailures: { itemIdentifier: string }[] = [];
  for (const record of event.Records) {
    const workerStart = Date.now();
    const client = await pool.connect();
    try {
      const retry = await runIngestionRecord({ record, client, pool, workerStart, log }, buildService, 'STRANDS');
      if (retry) batchItemFailures.push({ itemIdentifier: record.messageId });
    } finally {
      client.release();
    }
  }

  return { batchItemFailures };
};
