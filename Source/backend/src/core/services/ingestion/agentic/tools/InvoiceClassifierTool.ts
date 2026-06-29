import type { IInvoiceClassifier, ClassificationInput } from '../../../../ports/data-intelligence/IInvoiceClassifier';

// Tool 4 (parent §3): resolve the overarching invoice category (merchant prior → line-item
// vote → LLM tiebreak). Thin wrapper over InvoiceClassifier.
export class InvoiceClassifierTool {
  constructor(private readonly classifier: IInvoiceClassifier) {}

  run(input: ClassificationInput): Promise<string | null> {
    return this.classifier.classify(input);
  }
}
