import type { BedrockConverseRequest, BedrockDocument, BedrockImage, BedrockMessage, IBedrockConverse } from '../../ports/ai/IBedrockConverse';
import { parseReceiptJson } from '../../domain/receiptSchema';
import { callJsonWithRetry } from '../../domain/llmJson';
import { dropNonItemLines, collapseContinuationLines } from '../../domain/receiptPostProcess';
import type { ParsedReceipt } from '../../domain/ingestion';

export interface ReceiptContext {
  countryCode: string;
  processedDate: string; // ISO YYYY-MM-DD
}

function buildUserInstruction(ctx: ReceiptContext): string {
  return [
    `<user_country>${ctx.countryCode}</user_country>`,
    `<processed_date>${ctx.processedDate}</processed_date>`,
    '<task>Analyze the attached receipt and extract it as JSON matching the schema. Respond with JSON only.</task>',
  ].join('\n');
}

export class VisionParseService {
  constructor(
    private readonly converse: IBedrockConverse,
    private readonly modelId: string,
    private readonly promptTemplate: string,
    private readonly promptVersion: string,
  ) {}

  // The receipt arrives as an image (JPEG/PNG → image block) or a PDF (→ native
  // document block); the adapter picks the Converse content shape from which field is set.
  async parse(attachment: BedrockImage | BedrockDocument, ctx: ReceiptContext): Promise<ParsedReceipt> {
    const message: BedrockMessage =
      attachment.format === 'pdf'
        ? { role: 'user', content: buildUserInstruction(ctx), document: attachment }
        : { role: 'user', content: buildUserInstruction(ctx), image: attachment };
    const receipt = await callJsonWithRetry({
      call: request => this.converse.converse(request),
      buildRequest: messages => this.buildRequest(messages),
      messages: [message],
      validate: parseReceiptJson,
    });
    // Deterministic safety net: strip summary/loyalty/metadata rows the model may have
    // emitted despite the prompt's <exclusion_list>, then fold any standalone "N x price"
    // breakdown into its product line (the model double-counts these on long receipts).
    return collapseContinuationLines(dropNonItemLines(receipt));
  }

  private buildRequest(messages: BedrockMessage[]): BedrockConverseRequest {
    return {
      modelId: this.modelId,
      stage: 'VISION_PARSE',
      messages,
      systemPrompt: this.promptTemplate,
      promptVersion: this.promptVersion,
    };
  }
}
