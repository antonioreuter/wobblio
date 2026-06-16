import type { IBedrockConverse, BedrockConverseRequest, BedrockConverseResult } from '@core/ports/IBedrockConverse';
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
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, stream: false, options: { temperature: 0 } }),
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
