import type { IBedrockEmbedder } from '@core/ports/data-intelligence/IBedrockEmbedder';
import { BedrockCallError } from '@core/domain/errors';

const TARGET_DIMENSIONS = 512; // the product.embedding column is vector(512)

// Local Bedrock-embedder stand-in. Ollama embedding models output their own native
// dimension (nomic-embed-text = 768), so we resize to 512 to fit the column. This is
// a local-parity shim only; AWS uses Titan V2's native 512-dim output.
export class OllamaEmbedderAdapter implements IBedrockEmbedder {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async embed(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt: text }),
      });
      if (!response.ok) {
        throw new BedrockCallError(`Ollama embeddings call failed: ${response.status} ${await response.text()}`);
      }
      const body = (await response.json()) as { embedding?: number[] };
      if (!body.embedding || body.embedding.length === 0) {
        throw new BedrockCallError('Ollama embeddings response contained no embedding');
      }
      return resizeTo(body.embedding, TARGET_DIMENSIONS);
    } catch (err) {
      if (err instanceof BedrockCallError) throw err;
      throw new BedrockCallError('Ollama embed call failed', err);
    }
  }
}

function resizeTo(vector: number[], size: number): number[] {
  if (vector.length === size) return vector;
  if (vector.length > size) return vector.slice(0, size);
  return [...vector, ...new Array(size - vector.length).fill(0)];
}
