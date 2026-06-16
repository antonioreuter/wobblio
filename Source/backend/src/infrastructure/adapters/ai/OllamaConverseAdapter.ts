import type { IBedrockConverse, BedrockConverseRequest, BedrockConverseResult } from '@core/ports/ai/IBedrockConverse';
import { BedrockCallError } from '@core/domain/errors';

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

// Local-only Bedrock stand-in. Implements the same IBedrockConverse port so the
// worker/services run an identical code path locally and on AWS (parity rule).
export class OllamaConverseAdapter implements IBedrockConverse {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async converse(request: BedrockConverseRequest): Promise<BedrockConverseResult> {
    const start = Date.now();
    const messages = [
      ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
      ...request.messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.image ? { images: [Buffer.from(m.image.bytes).toString('base64')] } : {}),
      })),
    ];

    try {
      const options: Record<string, number> = { temperature: request.temperature ?? 0 };
      if (request.maxTokens) options.num_predict = request.maxTokens;
      // Vision images consume thousands of input tokens; raise the local context
      // window past Ollama's 4096 default when configured. Local-only (Bedrock ignores).
      if (process.env.OLLAMA_NUM_CTX) options.num_ctx = parseInt(process.env.OLLAMA_NUM_CTX, 10);
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, stream: false, options }),
      });
      if (!response.ok) {
        throw new BedrockCallError(`Ollama call failed: ${response.status} ${await response.text()}`);
      }
      const body = (await response.json()) as OllamaChatResponse;
      return {
        content: body.message?.content ?? '',
        inputTokens: body.prompt_eval_count ?? 0,
        outputTokens: body.eval_count ?? 0,
        modelId: this.model,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      if (err instanceof BedrockCallError) throw err;
      throw new BedrockCallError('Ollama Converse call failed', err);
    }
  }
}
