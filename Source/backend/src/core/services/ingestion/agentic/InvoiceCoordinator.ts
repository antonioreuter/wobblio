import type { ParsedReceipt } from '../../../domain/ingestion';
import type { ResolvedIngestionLocation } from '../../../domain/region';
import type { AgenticStage } from '../../../domain/agenticStage';
import type { IAgenticStageInstrumentation } from '../../../ports/observability/IAgenticStageInstrumentation';
import type { IProcessingProgress } from '../../../ports/ingestion/IProcessingProgress';
import type { ProcessingStage } from '../../../domain/processingStage';
import type { ExtractionResult } from '../InvoiceFinalizer';
import type { MerchantResolverTool } from './tools/MerchantResolverTool';
import type { ProductNormalizerTool } from './tools/ProductNormalizerTool';
import type { InvoiceClassifierTool } from './tools/InvoiceClassifierTool';
import type { SearchTagGeneratorTool } from './tools/SearchTagGeneratorTool';

// The STRANDS coordinator (parent §3). It dispatches the canonicalization tools in a FIXED
// order — merchant → product → classify → tag — after OCR + location (handled by
// ExtractionPreparer). Per the spec the agent must NOT free-choose stage order, so this is a
// deterministic workflow over a tool seam, not model-driven reasoning: an LLM coordinator
// would add cost and non-determinism for an order we are required to fix anyway. A real
// @strands-agents/sdk agent can later implement this same `extract` contract unchanged.
//
// The guarantees the spec attaches to the coordinator already live where they belong, so they
// are not re-implemented here: schema validation + one retry-with-errors are enforced at the
// only untrusted-JSON boundary (VisionParseService → DLQ on a second failure); the
// arithmetic-balance + integrity gate runs once, downstream, in InvoiceFinalizer — shared with
// the legacy pipeline so STRANDS and LEGACY treat a mis-summing receipt identically.
export class InvoiceCoordinator {
  constructor(
    private readonly merchantTool: MerchantResolverTool,
    private readonly productTool: ProductNormalizerTool,
    private readonly classifierTool: InvoiceClassifierTool,
    private readonly tagTool: SearchTagGeneratorTool,
    private readonly instrumentation: IAgenticStageInstrumentation,
    private readonly progress: IProcessingProgress,
  ) {}

  // `tenantId` is carried only to scope the progress writes: they run on their own connection
  // (outside this pipeline's transaction) and so must set their own RLS context.
  async extract(receipt: ParsedReceipt, location: ResolvedIngestionLocation, invoiceId: string, tenantId: string): Promise<ExtractionResult> {
    // All four tools collapse into one user-visible stage: they total ~5s, and classification
    // and tag generation are ~0ms deterministic paths that would only flicker.
    await this.recordProgressSafely(invoiceId, tenantId, 'MATCHING');

    const merchant = await this.runStage('MERCHANT_RESOLUTION', invoiceId, () =>
      this.merchantTool.run(receipt.merchantRaw, location.countryCode),
    );
    const { lines: normalized, suggestedTags } = await this.runStage('PRODUCT_NORMALIZATION', invoiceId, () =>
      this.productTool.run(merchant.merchantId, receipt.lines, location.countryCode, {
        brandName: merchant.brandName,
        categoryPrior: merchant.defaultCategoryId,
        documentKindHint: receipt.documentKindHint,
      }),
    );
    const categoryId = await this.runStage('INVOICE_CLASSIFICATION', invoiceId, () =>
      this.classifierTool.run({
        merchantId: merchant.merchantId,
        merchantPrior: merchant.defaultCategoryId,
        documentKindHint: receipt.documentKindHint,
        lines: receipt.lines,
        normalized,
      }),
    );
    const tags = await this.runStage('TAG_GENERATION', invoiceId, () =>
      this.tagTool.run({
        merchantId: merchant.merchantId,
        merchantBrand: merchant.brandName,
        categoryId,
        lines: receipt.lines,
        normalized,
        suggestedTags,
      }),
    );

    await this.recordProgressSafely(invoiceId, tenantId, 'FINALIZING');

    return { receipt, location, merchant, normalized, categoryId, tags };
  }

  // Same defensive guard as recordStageOutcomeSafely: the port promises never to throw, but
  // nothing outside this call site enforces it, and a progress write must never be the reason a
  // successfully-canonicalized invoice fails.
  private async recordProgressSafely(invoiceId: string, tenantId: string, stage: ProcessingStage): Promise<void> {
    try {
      await this.progress.recordStage(invoiceId, tenantId, stage);
    } catch {
      // Progress failures must never affect ingestion outcome.
    }
  }

  // Times and reports one stage to the instrumentation port, then rethrows the ORIGINAL error
  // unchanged — ingestionWorkerShell's isSystemFault/isNonRetryable classification inspects the
  // thrown error's type/code directly, so wrapping it here would silently break fault routing.
  private async runStage<T>(stage: AgenticStage, invoiceId: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.recordStageOutcomeSafely(stage, invoiceId, Date.now() - start);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.recordStageOutcomeSafely(stage, invoiceId, Date.now() - start, message);
      throw err;
    }
  }

  // The port contract says the adapter must never throw, but nothing outside this call site
  // enforces it — guard anyway so a broken/future adapter can't itself become the thrown error
  // (mislabeling a successful stage as failed) or swallow the tool's real result.
  private recordStageOutcomeSafely(stage: AgenticStage, invoiceId: string, durationMs: number, error?: string): void {
    try {
      this.instrumentation.recordStageOutcome(stage, invoiceId, durationMs, error);
    } catch {
      // Instrumentation failures must never affect ingestion outcome.
    }
  }
}
