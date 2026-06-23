import { BedrockRuntimeClient, ConverseCommand, type ContentBlock } from '@aws-sdk/client-bedrock-runtime';
import type { IBedrockConverse, BedrockConverseRequest, BedrockConverseResult, BedrockMessage } from '@core/ports/ai/IBedrockConverse';
import { BedrockCallError } from '@core/domain/errors';
import { buildBedrockRuntimeClient } from '@infrastructure/config/bedrockClient';
import { logBedrockUsage } from '../../logging/bedrockUsageLog';

export class BedrockConverseAdapter implements IBedrockConverse {
  private readonly client: BedrockRuntimeClient;

  constructor(region: string) {
    this.client = buildBedrockRuntimeClient(region);
  }

  async converse(request: BedrockConverseRequest): Promise<BedrockConverseResult> {
    const start = Date.now();
    try {
      const response = await this.client.send(
        new ConverseCommand({
          modelId: request.modelId,
          messages: request.messages.map(m => ({
            role: m.role,
            content: toContentBlocks(m),
          })),
          system: request.systemPrompt ? [{ text: request.systemPrompt }] : undefined,
          // Default a generous output ceiling so large receipts don't truncate mid-JSON
          // (a truncated response fails schema validation). Callers may still override.
          inferenceConfig: { temperature: request.temperature ?? 0, maxTokens: request.maxTokens ?? 4096 },
        }),
      );

      const inputTokens = response.usage?.inputTokens ?? 0;
      const outputTokens = response.usage?.outputTokens ?? 0;
      const durationMs = Date.now() - start;
      const content = extractText(response.output?.message?.content);

      logBedrockUsage(request.stage, request.modelId, inputTokens, outputTokens, durationMs);

      return { content, inputTokens, outputTokens, modelId: request.modelId, durationMs };
    } catch (err) {
      if (err instanceof BedrockCallError) throw err;
      throw new BedrockCallError('Bedrock Converse call failed', err);
    }
  }
}

// A PDF rides as a native document block; an image as an image block; otherwise
// text-only. Document/image are mutually exclusive on a message (see the port).
function toContentBlocks(m: BedrockMessage): ContentBlock[] {
  if (m.document) {
    return [
      { document: { format: m.document.format, name: m.document.name, source: { bytes: m.document.bytes } } },
      { text: m.content },
    ];
  }
  if (m.image) {
    return [{ image: { format: m.image.format, source: { bytes: m.image.bytes } } }, { text: m.content }];
  }
  return [{ text: m.content }];
}

function extractText(content: Array<{ text?: string }> | undefined): string {
  return content?.find(b => b.text !== undefined)?.text ?? '';
}
