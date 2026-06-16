import type { IBedrockConverse } from '@core/ports/ai/IBedrockConverse';
import { BedrockConverseAdapter } from './BedrockConverseAdapter';
import { OllamaConverseAdapter } from './OllamaConverseAdapter';

const DEFAULT_OLLAMA_URL = 'http://192.168.86.86:11434';
const DEFAULT_OLLAMA_MODEL = 'gemma4:31b-it-qat';

// Local dev runs against a network Ollama instance; AWS uses Bedrock. Same port,
// so the worker/services are identical across environments.
export function buildConverseAdapter(region: string): IBedrockConverse {
  if (process.env.STAGE === 'local') {
    return new OllamaConverseAdapter(
      process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_URL,
      process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL,
    );
  }
  return new BedrockConverseAdapter(region);
}
