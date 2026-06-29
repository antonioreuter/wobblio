import type { EmbeddingResult, IBedrockEmbedder } from '../../ports/data-intelligence/IBedrockEmbedder';
import type { TokenMeter } from '../../domain/tokenMeter';

// Pass-through decorator recording embedding input tokens into the shared meter. Titan
// embeddings have no output tokens. ProductNormalizer stays unaware of token accounting.
export class MeteringBedrockEmbedder implements IBedrockEmbedder {
  constructor(
    private readonly inner: IBedrockEmbedder,
    private readonly meter: TokenMeter,
  ) {}

  async embed(text: string): Promise<EmbeddingResult> {
    const result = await this.inner.embed(text);
    this.meter.record('EMBEDDING', result.inputTokens, 0);
    return result;
  }
}
