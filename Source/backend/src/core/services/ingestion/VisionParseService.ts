import type { BedrockConverseRequest, BedrockImage, BedrockMessage } from '../../ports/ai/IBedrockConverse';
import type { BedrockSpendGuardService } from '../ai/BedrockSpendGuardService';
import { parseReceiptJson } from '../../domain/receiptSchema';
import { callJsonWithRetry } from '../../domain/llmJson';
import type { ParsedReceipt } from '../../domain/ingestion';

const USER_INSTRUCTION =
  '<task>Extract the receipt in the attached image as JSON matching the schema. Respond with JSON only.</task>';

export class VisionParseService {
  constructor(
    private readonly spendGuard: BedrockSpendGuardService,
    private readonly modelId: string,
    private readonly promptTemplate: string,
    private readonly promptVersion: string,
  ) {}

  async parse(tenantId: string, image: BedrockImage): Promise<ParsedReceipt> {
    return callJsonWithRetry({
      call: request => this.spendGuard.callWithSpendGuard(tenantId, request),
      buildRequest: messages => this.buildRequest(messages),
      messages: [{ role: 'user', content: USER_INSTRUCTION, image }],
      validate: parseReceiptJson,
    });
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
