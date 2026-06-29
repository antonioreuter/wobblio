import type { ParsedReceipt } from '../../../domain/ingestion';
import type { ResolvedIngestionLocation } from '../../../domain/region';
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
  ) {}

  async extract(receipt: ParsedReceipt, location: ResolvedIngestionLocation): Promise<ExtractionResult> {
    const merchant = await this.merchantTool.run(receipt.merchantRaw, location.countryCode);
    const { lines: normalized, suggestedTags } = await this.productTool.run(
      merchant.merchantId,
      receipt.lines,
      location.countryCode,
    );
    const categoryId = await this.classifierTool.run({
      merchantId: merchant.merchantId,
      documentKindHint: receipt.documentKindHint,
      lines: receipt.lines,
      normalized,
    });
    const tags = await this.tagTool.run({
      merchantId: merchant.merchantId,
      merchantBrand: merchant.brandName,
      categoryId,
      lines: receipt.lines,
      normalized,
      suggestedTags,
    });

    return { receipt, location, merchant, normalized, categoryId, tags };
  }
}
