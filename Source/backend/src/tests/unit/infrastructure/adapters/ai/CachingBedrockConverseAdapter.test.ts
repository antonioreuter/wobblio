import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { CachingBedrockConverseAdapter } from '@infrastructure/adapters/ai/CachingBedrockConverseAdapter';
import type { BedrockConverseRequest } from '@core/ports/ai/IBedrockConverse';

function usageResponse(usage: Record<string, number>) {
  return {
    output: { message: { content: [{ text: '{"ok":true}' }] } },
    usage,
  };
}

const baseRequest: BedrockConverseRequest = {
  modelId: 'eu.anthropic.claude-sonnet-4-6',
  stage: 'VISION_PARSE',
  messages: [{ role: 'user', content: '<task>extract</task>', image: { format: 'jpeg', bytes: new Uint8Array([1, 2, 3]) } }],
  systemPrompt: 'BIG STATIC PROMPT',
  promptVersion: 'vision-parse/v9',
};

describe('CachingBedrockConverseAdapter', () => {
  let send: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    send = vi.spyOn(BedrockRuntimeClient.prototype, 'send' as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function lastCommandInput() {
    const cmd = send.mock.calls[0][0] as ConverseCommand;
    return cmd.input;
  }

  it('appends a cachePoint checkpoint after the system prompt', async () => {
    send.mockResolvedValue(usageResponse({ inputTokens: 100, outputTokens: 50 }) as never);

    await new CachingBedrockConverseAdapter('eu-west-1').converse(baseRequest);

    expect(lastCommandInput().system).toEqual([
      { text: 'BIG STATIC PROMPT' },
      { cachePoint: { type: 'default' } },
    ]);
  });

  it('surfaces cache read/write tokens from the usage response', async () => {
    send.mockResolvedValue(
      usageResponse({ inputTokens: 40, outputTokens: 20, cacheReadInputTokens: 900, cacheWriteInputTokens: 0 }) as never,
    );

    const result = await new CachingBedrockConverseAdapter('eu-west-1').converse(baseRequest);

    expect(result.inputTokens).toBe(40);
    expect(result.outputTokens).toBe(20);
    expect(result.cacheReadInputTokens).toBe(900);
    expect(result.cacheWriteInputTokens).toBe(0);
  });

  it('defaults cache tokens to 0 when the model reports no cache usage', async () => {
    send.mockResolvedValue(usageResponse({ inputTokens: 100, outputTokens: 50 }) as never);

    const result = await new CachingBedrockConverseAdapter('eu-west-1').converse(baseRequest);

    expect(result.cacheReadInputTokens).toBe(0);
    expect(result.cacheWriteInputTokens).toBe(0);
  });

  it('sends no system block (no cachePoint) when there is no system prompt', async () => {
    send.mockResolvedValue(usageResponse({ inputTokens: 10, outputTokens: 5 }) as never);

    await new CachingBedrockConverseAdapter('eu-west-1').converse({ ...baseRequest, systemPrompt: undefined });

    expect(lastCommandInput().system).toBeUndefined();
  });
});
