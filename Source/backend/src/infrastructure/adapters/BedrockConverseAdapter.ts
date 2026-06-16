import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { IBedrockConverse, BedrockConverseRequest, BedrockConverseResult } from '@core/ports/IBedrockConverse';
import { BedrockCallError } from '@core/domain/errors';
import { emitBedrockTokenMetric } from '../metrics/emf';

export class BedrockConverseAdapter implements IBedrockConverse {
  private readonly client: BedrockRuntimeClient;

  constructor(region: string) {
    this.client = new BedrockRuntimeClient({ region });
  }

  async converse(request: BedrockConverseRequest): Promise<BedrockConverseResult> {
    const start = Date.now();
    try {
      const response = await this.client.send(
        new ConverseCommand({
          modelId: request.modelId,
          messages: request.messages.map(m => ({
            role: m.role,
            content: m.image
              ? [{ image: { format: m.image.format, source: { bytes: m.image.bytes } } }, { text: m.content }]
              : [{ text: m.content }],
          })),
          system: request.systemPrompt ? [{ text: request.systemPrompt }] : undefined,
        }),
      );

      const inputTokens = response.usage?.inputTokens ?? 0;
      const outputTokens = response.usage?.outputTokens ?? 0;
      const durationMs = Date.now() - start;
      const content = extractText(response.output?.message?.content);

      await emitBedrockTokenMetric(request.stage, request.modelId, inputTokens, outputTokens, durationMs);

      return { content, inputTokens, outputTokens, modelId: request.modelId, durationMs };
    } catch (err) {
      if (err instanceof BedrockCallError) throw err;
      throw new BedrockCallError('Bedrock Converse call failed', err);
    }
  }
}

function extractText(content: Array<{ text?: string }> | undefined): string {
  return content?.find(b => b.text !== undefined)?.text ?? '';
}
