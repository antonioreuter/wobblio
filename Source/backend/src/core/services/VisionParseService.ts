import type { BedrockConverseRequest, BedrockImage, BedrockMessage } from '../ports/IBedrockConverse';
import type { BedrockSpendGuardService } from './BedrockSpendGuardService';
import { parseReceiptJson } from '../domain/receiptSchema';
import { SchemaValidationError } from '../domain/errors';
import type { ParsedReceipt } from '../domain/ingestion';

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
    const messages: BedrockMessage[] = [{ role: 'user', content: USER_INSTRUCTION, image }];
    const first = await this.spendGuard.callWithSpendGuard(tenantId, this.buildRequest(messages));
    const firstResult = parseReceiptJson(first.content);
    if (firstResult.ok) return firstResult.value;

    const retryMessages: BedrockMessage[] = [
      ...messages,
      { role: 'assistant', content: first.content },
      {
        role: 'user',
        content: `<validation_errors>${firstResult.issues}</validation_errors>\nReturn corrected JSON only.`,
      },
    ];
    const second = await this.spendGuard.callWithSpendGuard(tenantId, this.buildRequest(retryMessages));
    const secondResult = parseReceiptJson(second.content);
    if (secondResult.ok) return secondResult.value;

    throw new SchemaValidationError(secondResult.issues);
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
