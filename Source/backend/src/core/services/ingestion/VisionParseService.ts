import type { BedrockConverseRequest, BedrockDocument, BedrockImage, BedrockMessage, BedrockStage, IBedrockConverse } from '../../ports/ai/IBedrockConverse';
import type { IReceiptParser, ReceiptContext } from '../../ports/ingestion/IReceiptParser';
import { parseReceiptJson } from '../../domain/receiptSchema';
import { callJsonWithRetry } from '../../domain/llmJson';
import { dropNonItemLines, collapseContinuationLines } from '../../domain/receiptPostProcess';
import { isUnreadableVerdict, type ParsedReceipt, type UnreadableVerdict } from '../../domain/ingestion';

export type { ReceiptContext } from '../../ports/ingestion/IReceiptParser';

// The system prompt + its version, chosen per receipt. Kept as a plain function so the
// concrete selection (country-composed vs a fixed prompt) is a composition-root concern —
// core stays free of prompt-artifact imports.
export interface VisionPromptSelection {
  template: string;
  version: string;
}
export type VisionPromptSelector = (countryCode: string | undefined) => VisionPromptSelection;

function buildUserInstruction(ctx: ReceiptContext): string {
  return [
    `<user_country>${ctx.countryCode}</user_country>`,
    `<processed_date>${ctx.processedDate}</processed_date>`,
    '<task>Analyze the attached receipt and extract it as JSON matching the schema. Respond with JSON only.</task>',
  ].join('\n');
}

export class VisionParseService implements IReceiptParser {
  constructor(
    private readonly converse: IBedrockConverse,
    private readonly modelId: string,
    // Resolves the system prompt + version from the receipt's country (ReceiptContext).
    // The composition root injects the country-composing selector for image parsing and a
    // fixed-prompt selector for PDFs.
    private readonly selectPrompt: VisionPromptSelector,
    // Telemetry stage: the fallback instance passes VISION_PARSE_FALLBACK so its (pricier)
    // tokens are metered and costed under the vision_fallback role, not the primary parser.
    private readonly stage: BedrockStage = 'VISION_PARSE',
  ) {}

  // The receipt arrives as an image (JPEG/PNG → image block) or a PDF (→ native
  // document block); the adapter picks the Converse content shape from which field is set.
  async parse(attachment: BedrockImage | BedrockDocument, ctx: ReceiptContext): Promise<ParsedReceipt | UnreadableVerdict> {
    const prompt = this.selectPrompt(ctx.countryCode);
    const message: BedrockMessage =
      attachment.format === 'pdf'
        ? { role: 'user', content: buildUserInstruction(ctx), document: attachment }
        : { role: 'user', content: buildUserInstruction(ctx), image: attachment };
    const result = await callJsonWithRetry({
      call: request => this.converse.converse(request),
      buildRequest: messages => this.buildRequest(messages, prompt),
      messages: [message],
      validate: parseReceiptJson,
    });
    // The model declared the image unreadable — pass the verdict through untouched.
    if (isUnreadableVerdict(result)) return result;
    // Deterministic safety net: strip summary/loyalty/metadata rows the model may have
    // emitted despite the prompt's <exclusion_list>, then fold any standalone "N x price"
    // breakdown into its product line (the model double-counts these on long receipts).
    return collapseContinuationLines(dropNonItemLines(result));
  }

  private buildRequest(messages: BedrockMessage[], prompt: VisionPromptSelection): BedrockConverseRequest {
    return {
      modelId: this.modelId,
      stage: this.stage,
      messages,
      systemPrompt: prompt.template,
      promptVersion: prompt.version,
    };
  }
}
