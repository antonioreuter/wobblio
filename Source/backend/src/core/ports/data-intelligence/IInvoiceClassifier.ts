import type { ParsedLine } from '@core/domain/ingestion';
import type { NormalizedLine } from '@core/ports/data-intelligence/IProductNormalizer';

export interface ClassificationInput {
  merchantId: string | null;
  // The merchant's default_category_id, already resolved upstream (§6.2). Authoritative
  // when set — passed in so the classifier does not re-read it from the catalog.
  merchantPrior: string | null;
  documentKindHint?: string;
  lines: ParsedLine[];
  normalized: NormalizedLine[];
}

// §6.4 invoice classification → one macro category_id.
export interface IInvoiceClassifier {
  classify(input: ClassificationInput): Promise<string | null>;
}
