import { describe, it, expect, vi } from 'vitest';
import { callJsonWithRetry, type JsonValidation } from '@core/domain/llmJson';
import { SchemaValidationError } from '@core/domain/errors';
import type { BedrockConverseRequest, BedrockConverseResult, BedrockMessage } from '@core/ports/ai/IBedrockConverse';

const result = (content: string): BedrockConverseResult => ({
  content,
  inputTokens: 1,
  outputTokens: 1,
  modelId: 'm',
  durationMs: 1,
});

const buildRequest = (messages: BedrockMessage[]): BedrockConverseRequest => ({
  modelId: 'm',
  stage: 'MERCHANT_FALLBACK',
  messages,
  promptVersion: 'v1',
});

const messages: BedrockMessage[] = [{ role: 'user', content: 'go' }];

const okOnValue = (value: string) => (content: string): JsonValidation<string> =>
  content === 'good' ? { ok: true, value } : { ok: false, issues: 'bad output' };

describe('callJsonWithRetry', () => {
  it('returns the validated value on the first success', async () => {
    const call = vi.fn().mockResolvedValue(result('good'));
    const value = await callJsonWithRetry({ call, buildRequest, messages, validate: okOnValue('parsed') });
    expect(value).toBe('parsed');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('retries once with the validation errors and returns on the second success', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce(result('bad'))
      .mockResolvedValueOnce(result('good'));
    const value = await callJsonWithRetry({ call, buildRequest, messages, validate: okOnValue('parsed') });
    expect(value).toBe('parsed');
    expect(call).toHaveBeenCalledTimes(2);

    const retryRequest = call.mock.calls[1][0] as BedrockConverseRequest;
    expect(retryRequest.messages.at(-2)).toEqual({ role: 'assistant', content: 'bad' });
    expect(retryRequest.messages.at(-1)?.content).toContain('<validation_errors>bad output</validation_errors>');
  });

  it('throws SchemaValidationError after a second failure', async () => {
    const call = vi.fn().mockResolvedValue(result('bad'));
    await expect(
      callJsonWithRetry({ call, buildRequest, messages, validate: okOnValue('parsed') }),
    ).rejects.toBeInstanceOf(SchemaValidationError);
    expect(call).toHaveBeenCalledTimes(2);
  });
});
