import type { IInvoiceClassifier, ClassificationInput } from '../../ports/data-intelligence/IInvoiceClassifier';
import type { IMerchantCatalog } from '../../ports/data-intelligence/IMerchantCatalog';
import type { BedrockConverseRequest, BedrockMessage, IBedrockConverse } from '../../ports/ai/IBedrockConverse';
import { voteCategory, type CategoryVoteLine } from '../../domain/classification';
import { CATEGORY_TAXONOMY, DINING_OUT_CATEGORY_ID, macroCategoryId } from '../../domain/categoryTaxonomy';
import { callJsonWithRetry } from '../../domain/llmJson';
import { parseClassificationTiebreakJson } from '../../domain/classificationTiebreakSchema';
import { CLASSIFICATION_TIEBREAK_PROMPT, CLASSIFICATION_TIEBREAK_PROMPT_VERSION } from '../../../prompts/classificationTiebreak';

const RESTAURANT_BILL_HINT = 'RESTAURANT_BILL';

// §6.4 invoice classification: a clear line-item majority wins; otherwise the
// merchant's default-category prior; otherwise an LLM tiebreak.
export class InvoiceClassifier implements IInvoiceClassifier {
  constructor(
    private readonly catalog: IMerchantCatalog,
    private readonly converse: IBedrockConverse,
    private readonly modelId: string,
  ) {}

  async classify(input: ClassificationInput): Promise<string | null> {
    if (input.documentKindHint === RESTAURANT_BILL_HINT) return DINING_OUT_CATEGORY_ID;

    // A clear majority macro (>50% spend) is decisive on its own.
    const vote = voteCategory(toVoteLines(input));
    if (!vote.needsTiebreak) return vote.categoryId;

    // Otherwise the merchant prior is trusted only when the line-item vote agrees with
    // it (or there is no competing vote); a disagreement goes to the LLM tiebreak (§6.4).
    const prior = input.merchantId ? await this.catalog.getDefaultCategory(input.merchantId) : null;
    if (prior && (vote.categoryId === null || vote.categoryId === prior)) return prior;

    return this.tiebreak(input);
  }

  private async tiebreak(input: ClassificationInput): Promise<string> {
    const result = await callJsonWithRetry({
      call: request => this.converse.converse(request),
      buildRequest: messages => this.buildRequest(messages),
      messages: [{ role: 'user', content: buildTiebreakMessage(input) }],
      validate: parseClassificationTiebreakJson,
    });
    // The invoice category is always a macro, even if the model returns a sub-category.
    return macroCategoryId(result.categoryId);
  }

  private buildRequest(messages: BedrockMessage[]): BedrockConverseRequest {
    return {
      modelId: this.modelId,
      stage: 'CLASSIFICATION_TIEBREAK',
      messages,
      systemPrompt: CLASSIFICATION_TIEBREAK_PROMPT,
      promptVersion: CLASSIFICATION_TIEBREAK_PROMPT_VERSION,
      temperature: 0,
    };
  }
}

function toVoteLines(input: ClassificationInput): CategoryVoteLine[] {
  return input.lines.map((line, index) => ({ categoryId: input.normalized[index].categoryId, lineTotal: line.lineTotal }));
}

function buildTiebreakMessage(input: ClassificationInput): string {
  const categories = CATEGORY_TAXONOMY.map(c => `<category id="${c.id}">${c.name}</category>`).join('\n');
  const lines = input.lines
    .map((line, index) => `<line category="${input.normalized[index].categoryId ?? 'unknown'}">${line.rawText}</line>`)
    .join('\n');
  return `<categories>\n${categories}\n</categories>\n<lines>\n${lines}\n</lines>`;
}
