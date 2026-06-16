import type { IMerchantResolver, MerchantResolution } from '@core/ports/IMerchantResolver';
import type { IProductNormalizer, NormalizedLine } from '@core/ports/IProductNormalizer';
import type { IInvoiceClassifier } from '@core/ports/IInvoiceClassifier';
import type { ITagGenerator } from '@core/ports/ITagGenerator';
import type { ParsedLine } from '@core/domain/ingestion';

// Placeholder data-intelligence stages for the ingestion vertical slice. The real
// §6.2–§6.10 implementations (alias/fuzzy/LLM resolution, pgvector matching,
// classification, tags, price observations) land in Epic 08. Until then the worker
// persists an un-enriched invoice whose status is driven by vision confidence.

export class StubMerchantResolver implements IMerchantResolver {
  async resolve(): Promise<MerchantResolution> {
    return { merchantId: null, branchId: null, confidence: 0 };
  }
}

export class StubProductNormalizer implements IProductNormalizer {
  async normalize(_merchantId: string | null, lines: ParsedLine[]): Promise<NormalizedLine[]> {
    return lines.map(() => ({
      productId: null,
      categoryId: null,
      baseUnit: null,
      packQuantity: null,
      normalizedUnitPrice: null,
      isDepositOrFee: false,
      confidence: 0,
      lowConfidence: false,
    }));
  }
}

export class StubInvoiceClassifier implements IInvoiceClassifier {
  async classify(): Promise<string | null> {
    return null;
  }
}

export class StubTagGenerator implements ITagGenerator {
  async generate(): Promise<string[]> {
    return [];
  }
}
