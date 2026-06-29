import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { EmbeddingResult, IBedrockEmbedder } from '@core/ports/data-intelligence/IBedrockEmbedder';
import { BedrockCallError } from '@core/domain/errors';
import { buildBedrockRuntimeClient } from '@infrastructure/config/bedrockClient';
import { logBedrockUsage } from '../../logging/bedrockUsageLog';

const EMBED_DIMENSIONS = 512; // matches the product.embedding vector(512) column

// Titan Text Embeddings V2 via InvokeModel. Titan V2 supports a native output
// dimension, so no client-side resize is needed.
export class BedrockTitanEmbedderAdapter implements IBedrockEmbedder {
  private readonly client: BedrockRuntimeClient;

  constructor(region: string, private readonly modelId: string) {
    this.client = buildBedrockRuntimeClient(region);
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const start = Date.now();
    try {
      const response = await this.client.send(
        new InvokeModelCommand({
          modelId: this.modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({ inputText: text, dimensions: EMBED_DIMENSIONS, normalize: true }),
        }),
      );
      const parsed = JSON.parse(Buffer.from(response.body).toString('utf-8')) as {
        embedding?: number[];
        inputTextTokenCount?: number;
      };
      if (!parsed.embedding || parsed.embedding.length === 0) {
        throw new BedrockCallError('Titan embedding response contained no embedding');
      }
      // Embeddings are an output-less stage; Titan bills only input tokens. Log it like
      // every other model call so avg_tokens stays calibratable from bedrock_usage.
      const inputTokens = parsed.inputTextTokenCount ?? 0;
      logBedrockUsage('EMBEDDING', this.modelId, inputTokens, 0, Date.now() - start);
      return { embedding: parsed.embedding, inputTokens };
    } catch (err) {
      if (err instanceof BedrockCallError) throw err;
      throw new BedrockCallError('Bedrock Titan embed call failed', err);
    }
  }
}
