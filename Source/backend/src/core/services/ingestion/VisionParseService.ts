import type { BedrockConverseRequest, BedrockDocument, BedrockImage, BedrockMessage, BedrockStage, IBedrockConverse } from '../../ports/ai/IBedrockConverse';
import type { IReceiptParser, ReceiptContext } from '../../ports/ingestion/IReceiptParser';
import { parseReceiptJson } from '../../domain/receiptSchema';
import { callJsonWithRetry } from '../../domain/llmJson';
import { dropNonItemLines, collapseContinuationLines } from '../../domain/receiptPostProcess';
import { isUnreadableVerdict, type ParsedReceipt, type UnreadableVerdict } from '../../domain/ingestion';

export type { ReceiptContext } from '../../ports/ingestion/IReceiptParser';

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
    private readonly promptTemplate: string,
    private readonly promptVersion: string,
    // Telemetry stage: the fallback instance passes VISION_PARSE_FALLBACK so its (pricier)
    // tokens are metered and costed under the vision_fallback role, not the primary parser.
    private readonly stage: BedrockStage = 'VISION_PARSE',
  ) {}

  // The receipt arrives as an image (JPEG/PNG → image block) or a PDF (→ native
  // document block); the adapter picks the Converse content shape from which field is set.
  async parse(attachment: BedrockImage | BedrockDocument, ctx: ReceiptContext): Promise<ParsedReceipt | UnreadableVerdict> {
    const message: BedrockMessage =
      attachment.format === 'pdf'
        ? { role: 'user', content: buildUserInstruction(ctx), document: attachment }
        : { role: 'user', content: buildUserInstruction(ctx), image: attachment };
    const result = await callJsonWithRetry({
      call: request => this.converse.converse(request),
      buildRequest: messages => this.buildRequest(messages),
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

  private buildRequest(messages: BedrockMessage[]): BedrockConverseRequest {
    return {
      modelId: this.modelId,
      stage: this.stage,
      messages,
      systemPrompt: this.promptTemplate,
      promptVersion: this.promptVersion,
    };
  }
}
