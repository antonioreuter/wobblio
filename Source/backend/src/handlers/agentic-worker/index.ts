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
import { SsmEscalationConfigAdapter } from '@infrastructure/adapters/ingestion/SsmEscalationConfigAdapter';
import { ProcessingProgressAdapter } from '@infrastructure/adapters/ingestion/ProcessingProgressAdapter';
import { MeteringBedrockConverse } from '@core/services/ai/MeteringBedrockConverse';
import { MeteringBedrockEmbedder } from '@core/services/ai/MeteringBedrockEmbedder';
import type { TokenMeter } from '@core/domain/tokenMeter';
import { runIngestionRecord } from '../shared/ingestionWorkerShell';
import { VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION } from '../../prompts/visionParse';
import { composeCountryVisionPrompt } from '../../prompts/visionParseByCountry';

// Image receipts: system prompt is composed per receipt from the user's country (packs +
// neutral default). PDFs stay on the shared monolith — packs are tuned for photo receipts.
// The PDF path reports a `+pdf`-tagged version so its parses are distinguishable in the
// swap-comparison telemetry (otherwise a non-NL PDF regression hides under bare `v9`).
const selectCountryPrompt = (countryCode: string | undefined) => composeCountryVisionPrompt(countryCode);
const fixedVisionPrompt = () => ({ template: VISION_PARSE_PROMPT, version: `${VISION_PARSE_PROMPT_VERSION}+pdf` });

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

// Module scope so the registry's TTL'd cache actually survives an invocation — a per-invocation
// instance made the cache dead code and paid six SSM round-trips on every single message. The TTL
// (not "forever") is what keeps the admin model-swap matrix effective without a cold start.
const modelRegistry = new SsmModelRegistryAdapter(REGION);
const escalationConfig = new SsmEscalationConfigAdapter(REGION);

// The ingestion worker (Non-Functional 01 §3). runIngestionRecord owns the transaction shell,
// charging, telemetry, and failure handling; this handler wires the service — a tool-based
// coordinator (deterministic forced order) over the domain services, between the shared
// ExtractionPreparer and InvoiceFinalizer.
export const handler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
  const log = createLambdaLogger('agentic-worker', context.awsRequestId);
  // max:2 — the pipeline's long transaction holds one connection; stage-progress writes (07/01)
  // need a second, or they would deadlock against it (see ProcessingProgressAdapter).
  const pool = await buildPool(process.env.DB_SECRET_ARN!, process.env.DB_HOST!, process.env.DB_PORT!, 5000, 2);
  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  // Independent reads, so they resolve together rather than in series. On a warm container every
  // one of these is a cache hit; on a cold one it is a single round-trip's latency, not six.
  // Optional escalation tiers: a low-quality primary parse re-runs on the mid (Sonnet) or deep
  // (Opus) model. Fail-open — an unprovisioned id leaves that tier off (deep→mid→primary).
  const [
    visionModelId,
    pdfModelId,
    auxiliaryModelId,
    embedderModelId,
    visionFallbackModelId,
    visionFallbackDeepModelId,
    escalationThresholds,
  ] = await Promise.all([
    modelRegistry.getModelId('vision_parser'),
    modelRegistry.getModelId('pdf_parser'),
    modelRegistry.getModelId('auxiliary'),
    modelRegistry.getModelId('embedder'),
    modelRegistry.getModelIdOptional('vision_fallback'),
    modelRegistry.getModelIdOptional('vision_fallback_deep'),
    escalationConfig.getThresholds(),
  ]);
  const converse = new BedrockConverseAdapter(REGION);
  const embedder = new BedrockTitanEmbedderAdapter(REGION, embedderModelId);
  const uploadLimits = new SsmUploadQuotaAdapter(REGION);
  const stageInstrumentation = new StructuredLogAgenticStageInstrumentation();
  // Bound to the pool, not the per-record client: progress must be visible DURING the run, so it
  // cannot ride the transaction that only commits once the run is already over.
  const progress = new ProcessingProgressAdapter(pool);

  const buildService = (client: PoolClient, meter: TokenMeter): AgenticIngestionService => {
    const meteredConverse = new MeteringBedrockConverse(converse, meter);
    const meteredEmbedder = new MeteringBedrockEmbedder(embedder, meter);
    const merchantCatalog = new MerchantCatalogAdapter(client);
    const productCatalog = new ProductCatalogAdapter(client);

    const primaryVision = new VisionParseService(meteredConverse, visionModelId, selectCountryPrompt);
    // Wrap the primary so a low-quality parse re-runs on a stronger model — the mid or deep tier
    // chosen by the blended-quality band (fix 11). Unprovisioned tiers fall through to the primary,
    // identical to today's behaviour. Escalating parsers share the country selector so every arm
    // reports the same v9c+<country>. `event: vision_escalation` logs frequency/tier/reason/score.
    const escalationTargets = {
      FALLBACK: visionFallbackModelId
        ? new VisionParseService(meteredConverse, visionFallbackModelId, selectCountryPrompt, 'VISION_PARSE_FALLBACK')
        : undefined,
      FALLBACK_DEEP: visionFallbackDeepModelId
        ? new VisionParseService(meteredConverse, visionFallbackDeepModelId, selectCountryPrompt, 'VISION_PARSE_FALLBACK_DEEP')
        : undefined,
    };
    const escalationEnabled = Boolean(escalationTargets.FALLBACK || escalationTargets.FALLBACK_DEEP);
    const visionParser = escalationEnabled
      ? new EscalatingReceiptParser(
          primaryVision,
          escalationTargets,
          escalationThresholds,
          (outcome) => log.info('vision parse escalated', { event: 'vision_escalation', ...outcome }),
        )
      : primaryVision;
    const ocr = new OcrParserTool(
      visionParser,
      new VisionParseService(meteredConverse, pdfModelId, fixedVisionPrompt),
    );
    const preparer = new ExtractionPreparer(
      new TenantContextAdapter(client),
      new IngestionLedgerAdapter(client),
      new S3FileStorageAdapter(REGION, uploadsBucket),
      new InvoiceRepositoryAdapter(client),
      new ContributorContextRepositoryAdapter(client),
      new RegionReferenceAdapter(client),
      uploadLimits,
      progress,
      ocr,
      escalationThresholds,
      escalationEnabled,
    );
    const coordinator = new InvoiceCoordinator(
      new MerchantResolverTool(new MerchantResolver(merchantCatalog, meteredConverse, auxiliaryModelId)),
      new ProductNormalizerTool(new ProductNormalizer(productCatalog, meteredEmbedder, meteredConverse, auxiliaryModelId)),
      new InvoiceClassifierTool(new InvoiceClassifier(meteredConverse, auxiliaryModelId)),
      new SearchTagGeneratorTool(new TagGenerator()),
      stageInstrumentation,
      progress,
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
      const retry = await runIngestionRecord({ record, client, pool, workerStart, log }, buildService);
      if (retry) batchItemFailures.push({ itemIdentifier: record.messageId });
    } finally {
      client.release();
    }
  }

  return { batchItemFailures };
};
