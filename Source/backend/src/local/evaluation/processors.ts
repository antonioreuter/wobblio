import type { PoolClient } from 'pg';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';
import { IngestionLedgerAdapter } from '@infrastructure/adapters/ingestion/IngestionLedgerAdapter';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { S3FileStorageAdapter } from '@infrastructure/adapters/ingestion/S3FileStorageAdapter';
import { MerchantCatalogAdapter } from '@infrastructure/adapters/data-intelligence/MerchantCatalogAdapter';
import { ProductCatalogAdapter } from '@infrastructure/adapters/data-intelligence/ProductCatalogAdapter';
import { PriceObservationStoreAdapter } from '@infrastructure/adapters/data-intelligence/PriceObservationStoreAdapter';
import { ContributorContextRepositoryAdapter } from '@infrastructure/adapters/data-intelligence/ContributorContextRepositoryAdapter';
import { RegionReferenceAdapter } from '@infrastructure/adapters/data-intelligence/RegionReferenceAdapter';
import { FxRateRepositoryAdapter } from '@infrastructure/adapters/fx/FxRateRepositoryAdapter';
import { CurrencyHarmonizationService } from '@core/services/fx/CurrencyHarmonizationService';
import { MeteringBedrockConverse } from '@core/services/ai/MeteringBedrockConverse';
import { MeteringBedrockEmbedder } from '@core/services/ai/MeteringBedrockEmbedder';
import type { IBedrockConverse } from '@core/ports/ai/IBedrockConverse';
import type { IBedrockEmbedder } from '@core/ports/data-intelligence/IBedrockEmbedder';
import type { IUploadLimitsProvider } from '@core/ports/quota/IUploadLimitsProvider';
import { VisionParseService } from '@core/services/ingestion/VisionParseService';
import { MerchantResolver } from '@core/services/data-intelligence/MerchantResolver';
import { ProductNormalizer } from '@core/services/data-intelligence/ProductNormalizer';
import { InvoiceClassifier } from '@core/services/data-intelligence/InvoiceClassifier';
import { TagGenerator } from '@core/services/data-intelligence/TagGenerator';
import { IngestionService } from '@core/services/ingestion/IngestionService';
import { AgenticIngestionService } from '@core/services/ingestion/AgenticIngestionService';
import { ExtractionPreparer } from '@core/services/ingestion/ExtractionPreparer';
import { InvoiceFinalizer } from '@core/services/ingestion/InvoiceFinalizer';
import { InvoiceCoordinator } from '@core/services/ingestion/agentic/InvoiceCoordinator';
import { MockAgenticStageInstrumentationAdapter } from '@infrastructure/adapters/observability/MockAgenticStageInstrumentationAdapter';
import { OcrParserTool } from '@core/services/ingestion/agentic/tools/OcrParserTool';
import { MerchantResolverTool } from '@core/services/ingestion/agentic/tools/MerchantResolverTool';
import { ProductNormalizerTool } from '@core/services/ingestion/agentic/tools/ProductNormalizerTool';
import { InvoiceClassifierTool } from '@core/services/ingestion/agentic/tools/InvoiceClassifierTool';
import { SearchTagGeneratorTool } from '@core/services/ingestion/agentic/tools/SearchTagGeneratorTool';
import { TokenMeter } from '@core/domain/tokenMeter';
import { estimateCostUsd } from '@core/domain/aiSpend';
import type { IngestionMessage } from '@core/ports/ingestion/IIngestionQueue';
import type { ExtractionResult } from '@core/services/ingestion/InvoiceFinalizer';
import type { PipelineRunMetrics } from '@core/domain/pipelineEvalSummary';
import type { PipelineType } from '@handlers/shared/ingestionWorkerShell';
import { VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION } from '../../prompts/visionParse';

// Shared, per-run dependencies for the dry-run harness. The Bedrock clients are raw (real);
// metering is applied per pipeline run so each gets its own token tally.
export interface EvalDeps {
  region: string;
  uploadsBucket: string;
  modelIds: { vision: string; pdf: string; auxiliary: string; embedder: string };
  converse: IBedrockConverse;
  embedder: IBedrockEmbedder;
}

export interface PipelineRun {
  outcome: 'ready' | 'duplicate' | 'unreadable';
  extraction?: ExtractionResult;
  metrics: PipelineRunMetrics;
  tokens: { input: number; output: number };
}

// Runs ONE pipeline's extract() (no finalize → no invoice persist, no price emission) with a
// fresh meter, returning the canonicalized output plus latency + estimated cost.
export async function runPipeline(
  pipeline: PipelineType,
  client: PoolClient,
  deps: EvalDeps,
  message: IngestionMessage,
): Promise<PipelineRun> {
  const meter = new TokenMeter();
  const service = pipeline === 'LEGACY' ? buildLegacy(client, deps, meter) : buildAgentic(client, deps, meter);

  const start = Date.now();
  const result = await service.extract(message);
  const processingMs = Date.now() - start;
  const metrics: PipelineRunMetrics = { processingMs, costUsd: estimateCostUsd(meter.stageBreakdown()) };
  const tokens = { input: meter.inputTotal, output: meter.outputTotal };

  if (result.kind !== 'ready') return { outcome: result.kind, metrics, tokens };
  return { outcome: 'ready', extraction: result.extraction, metrics, tokens };
}

function buildLegacy(client: PoolClient, deps: EvalDeps, meter: TokenMeter): IngestionService {
  const converse = new MeteringBedrockConverse(deps.converse, meter);
  const embedder = new MeteringBedrockEmbedder(deps.embedder, meter);
  const merchantCatalog = new MerchantCatalogAdapter(client);
  const productCatalog = new ProductCatalogAdapter(client);
  return new IngestionService(
    new TenantContextAdapter(client),
    new IngestionLedgerAdapter(client),
    new S3FileStorageAdapter(deps.region, deps.uploadsBucket),
    new VisionParseService(converse, deps.modelIds.vision, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION),
    new VisionParseService(converse, deps.modelIds.pdf, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION),
    new MerchantResolver(merchantCatalog, converse, deps.modelIds.auxiliary),
    new ProductNormalizer(productCatalog, embedder, converse, deps.modelIds.auxiliary),
    new InvoiceClassifier(merchantCatalog, converse, deps.modelIds.auxiliary),
    new TagGenerator(),
    new InvoiceRepositoryAdapter(client),
    new PriceObservationStoreAdapter(client),
    new ContributorContextRepositoryAdapter(client),
    new RegionReferenceAdapter(client),
    uploadLimits(),
    new FxRateRepositoryAdapter(client),
  );
}

function buildAgentic(client: PoolClient, deps: EvalDeps, meter: TokenMeter): AgenticIngestionService {
  const converse = new MeteringBedrockConverse(deps.converse, meter);
  const embedder = new MeteringBedrockEmbedder(deps.embedder, meter);
  const merchantCatalog = new MerchantCatalogAdapter(client);
  const productCatalog = new ProductCatalogAdapter(client);
  const ocr = new OcrParserTool(
    new VisionParseService(converse, deps.modelIds.vision, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION),
    new VisionParseService(converse, deps.modelIds.pdf, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION),
  );
  const preparer = new ExtractionPreparer(
    new TenantContextAdapter(client),
    new IngestionLedgerAdapter(client),
    new S3FileStorageAdapter(deps.region, deps.uploadsBucket),
    new InvoiceRepositoryAdapter(client),
    new ContributorContextRepositoryAdapter(client),
    new RegionReferenceAdapter(client),
    uploadLimits(),
    ocr,
  );
  const coordinator = new InvoiceCoordinator(
    new MerchantResolverTool(new MerchantResolver(merchantCatalog, converse, deps.modelIds.auxiliary)),
    new ProductNormalizerTool(new ProductNormalizer(productCatalog, embedder, converse, deps.modelIds.auxiliary)),
    new InvoiceClassifierTool(new InvoiceClassifier(merchantCatalog, converse, deps.modelIds.auxiliary)),
    new SearchTagGeneratorTool(new TagGenerator()),
    new MockAgenticStageInstrumentationAdapter(),
  );
  const finalizer = new InvoiceFinalizer(
    new InvoiceRepositoryAdapter(client),
    new PriceObservationStoreAdapter(client),
    new IngestionLedgerAdapter(client),
    new CurrencyHarmonizationService(new FxRateRepositoryAdapter(client)),
  );
  return new AgenticIngestionService(preparer, coordinator, finalizer);
}

// Generous in-memory upload limits — the eval bypasses the SSM quota adapter (no charging path
// here); fixtures are known-good, so size/page gates are effectively disabled.
function uploadLimits(): IUploadLimitsProvider {
  return {
    getMaxImageBytes: async () => 50 * 1024 * 1024,
    getMaxPdfBytes: async () => 50 * 1024 * 1024,
    getMaxPdfPages: async () => 100,
  };
}
