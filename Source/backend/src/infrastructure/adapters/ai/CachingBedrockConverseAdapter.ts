import { BedrockRuntimeClient, ConverseCommand, type SystemContentBlock } from '@aws-sdk/client-bedrock-runtime';
import type { IBedrockConverse, BedrockConverseRequest, BedrockConverseResult } from '@core/ports/ai/IBedrockConverse';
import { BedrockCallError } from '@core/domain/errors';
import { buildBedrockRuntimeClient } from '@infrastructure/config/bedrockClient';
import { logBedrockUsage } from '../../logging/bedrockUsageLog';
import { toContentBlocks, extractText } from './bedrockContentBlocks';

// Detached, drop-in IBedrockConverse that enables Bedrock prompt caching by appending a
// cachePoint after the system prompt — so the (large, static) system prefix is cached and
// re-read at ~0.1× on subsequent calls within the TTL. Only Claude/Nova models support this;
// sending a cachePoint to a model that does not (e.g. Qwen) raises a ValidationException, so
// this adapter is composed in DELIBERATELY, only around cache-capable tiers.
//
// Used today only by the offline vision-cost benchmark (Sonnet 4.6 + cache vs Qwen). Kept
// separate from BedrockConverseAdapter so it is trivial to remove if the study doesn't pan out.
export class CachingBedrockConverseAdapter implements IBedrockConverse {
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
          system: buildCachedSystem(request.systemPrompt),
          inferenceConfig: { temperature: request.temperature ?? 0, maxTokens: request.maxTokens ?? 4096 },
        }),
      );

      const inputTokens = response.usage?.inputTokens ?? 0;
      const outputTokens = response.usage?.outputTokens ?? 0;
      const cacheReadInputTokens = response.usage?.cacheReadInputTokens ?? 0;
      const cacheWriteInputTokens = response.usage?.cacheWriteInputTokens ?? 0;
      const durationMs = Date.now() - start;
      const content = extractText(response.output?.message?.content);

      logBedrockUsage(request.stage, request.modelId, inputTokens, outputTokens, durationMs);

      return { content, inputTokens, outputTokens, modelId: request.modelId, durationMs, cacheReadInputTokens, cacheWriteInputTokens };
    } catch (err) {
      if (err instanceof BedrockCallError) throw err;
      throw new BedrockCallError('Bedrock Converse call failed', err);
    }
  }
}

// The system prompt is the cached prefix: a text block followed by a cachePoint checkpoint.
// No system prompt → no caching (returns undefined, matching the plain adapter).
function buildCachedSystem(systemPrompt: string | undefined): SystemContentBlock[] | undefined {
  if (!systemPrompt) return undefined;
  return [{ text: systemPrompt }, { cachePoint: { type: 'default' } }];
}
