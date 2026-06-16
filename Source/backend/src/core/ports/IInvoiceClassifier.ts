import type { ParsedLine } from '@core/domain/ingestion';
import type { NormalizedLine } from '@core/ports/IProductNormalizer';

export interface ClassificationInput {
  merchantId: string | null;
  documentKindHint?: string;
  lines: ParsedLine[];
  normalized: NormalizedLine[];
}

// §6.4 invoice classification → one macro category_id. Real impl lands in Epic 08.
export interface IInvoiceClassifier {
  classify(input: ClassificationInput): Promise<string | null>;
}
