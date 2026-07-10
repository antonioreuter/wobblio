import type { IInvoiceClassifier, ClassificationInput } from '../../ports/data-intelligence/IInvoiceClassifier';
import type { BedrockConverseRequest, BedrockMessage, IBedrockConverse } from '../../ports/ai/IBedrockConverse';
import { voteCategory, type CategoryVoteLine } from '../../domain/classification';
import { CATEGORY_TAXONOMY, DINING_OUT_CATEGORY_ID, macroCategoryId } from '../../domain/categoryTaxonomy';
import { callJsonWithRetry } from '../../domain/llmJson';
import { RESTAURANT_BILL_HINT } from '../../domain/ingestion';
import { parseClassificationTiebreakJson } from '../../domain/classificationTiebreakSchema';
import { CLASSIFICATION_TIEBREAK_PROMPT, CLASSIFICATION_TIEBREAK_PROMPT_VERSION } from '../../../prompts/classificationTiebreak';

// §6.4 invoice classification: merchant DB prior is authoritative; line-item vote
// and LLM tiebreak are fallbacks for merchants not yet in the catalog.
export class InvoiceClassifier implements IInvoiceClassifier {
  constructor(
    private readonly converse: IBedrockConverse,
    private readonly modelId: string,
  ) {}

  async classify(input: ClassificationInput): Promise<string | null> {
    if (input.documentKindHint === RESTAURANT_BILL_HINT) return DINING_OUT_CATEGORY_ID;

    // Merchant prior is authoritative — a DB-classified merchant is never overridden
    // by line-item votes or LLM; the fallback path only runs for unknown merchants. The
    // prior is resolved upstream (§6.2) and passed in, so no catalog re-read here.
    if (input.merchantPrior) return macroCategoryId(input.merchantPrior);

    // No merchant prior: line-item majority vote, then LLM tiebreak.
    const vote = voteCategory(toVoteLines(input));
    if (!vote.needsTiebreak) return vote.categoryId;

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
