import type { IBedrockEmbedder } from '@core/ports/data-intelligence/IBedrockEmbedder';
import { BedrockTitanEmbedderAdapter } from './BedrockTitanEmbedderAdapter';
import { OllamaEmbedderAdapter } from './OllamaEmbedderAdapter';

const DEFAULT_OLLAMA_URL = 'http://192.168.86.86:11434';
const DEFAULT_OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text';

// Mirrors converseFactory: local dev embeds against a network Ollama; AWS uses
// Bedrock Titan V2. Same IBedrockEmbedder port, so services are env-agnostic.
export function buildEmbedderAdapter(region: string, modelId: string): IBedrockEmbedder {
  if (process.env.STAGE === 'local') {
    return new OllamaEmbedderAdapter(
      process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_URL,
      process.env.OLLAMA_EMBEDDING_MODEL ?? DEFAULT_OLLAMA_EMBEDDING_MODEL,
    );
  }
  return new BedrockTitanEmbedderAdapter(region, modelId);
}
