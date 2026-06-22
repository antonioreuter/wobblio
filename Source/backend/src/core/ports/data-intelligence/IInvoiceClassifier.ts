import type { ParsedLine } from '@core/domain/ingestion';
import type { NormalizedLine } from '@core/ports/data-intelligence/IProductNormalizer';

export interface ClassificationInput {
  merchantId: string | null;
  documentKindHint?: string;
  lines: ParsedLine[];
  normalized: NormalizedLine[];
}

// §6.4 invoice classification → one macro category_id.
export interface IInvoiceClassifier {
  classify(input: ClassificationInput): Promise<string | null>;
}
