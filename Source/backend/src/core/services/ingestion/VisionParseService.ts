import type { BedrockConverseRequest, BedrockImage, BedrockMessage } from '../../ports/ai/IBedrockConverse';
import type { BedrockSpendGuardService } from '../ai/BedrockSpendGuardService';
import { parseReceiptJson } from '../../domain/receiptSchema';
import { callJsonWithRetry } from '../../domain/llmJson';
import { dropNonItemLines } from '../../domain/receiptPostProcess';
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
    private readonly spendGuard: BedrockSpendGuardService,
    private readonly modelId: string,
    private readonly promptTemplate: string,
    private readonly promptVersion: string,
  ) {}

  async parse(tenantId: string, image: BedrockImage, ctx: ReceiptContext): Promise<ParsedReceipt> {
    const receipt = await callJsonWithRetry({
      call: request => this.spendGuard.callWithSpendGuard(tenantId, request),
      buildRequest: messages => this.buildRequest(messages),
      messages: [{ role: 'user', content: buildUserInstruction(ctx), image }],
      validate: parseReceiptJson,
    });
    // Deterministic safety net: strip summary/loyalty/metadata rows the model may have
    // emitted despite the prompt's <exclusion_list>, before downstream normalization.
    return dropNonItemLines(receipt);
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
