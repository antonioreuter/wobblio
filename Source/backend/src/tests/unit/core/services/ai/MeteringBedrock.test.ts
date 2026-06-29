import { describe, it, expect, vi } from 'vitest';
import { MeteringBedrockConverse } from '@core/services/ai/MeteringBedrockConverse';
import { MeteringBedrockEmbedder } from '@core/services/ai/MeteringBedrockEmbedder';
import { TokenMeter } from '@core/domain/tokenMeter';
import type { BedrockConverseRequest, BedrockConverseResult, IBedrockConverse } from '@core/ports/ai/IBedrockConverse';
import type { IBedrockEmbedder } from '@core/ports/data-intelligence/IBedrockEmbedder';

const request = { stage: 'VISION_PARSE' } as unknown as BedrockConverseRequest;

describe('MeteringBedrockConverse', () => {
  it('records input + output tokens and returns the inner result unchanged', async () => {
    const result: BedrockConverseResult = { content: '{}', inputTokens: 1200, outputTokens: 300, modelId: 'm', durationMs: 5 };
    const inner: IBedrockConverse = { converse: vi.fn().mockResolvedValue(result) };
    const meter = new TokenMeter();

    const out = await new MeteringBedrockConverse(inner, meter).converse(request);

    expect(out).toBe(result);
    expect(meter.total).toBe(1500);
  });

  it('accumulates across multiple calls into the shared meter', async () => {
    const inner: IBedrockConverse = {
      converse: vi.fn()
        .mockResolvedValueOnce({ content: '', inputTokens: 100, outputTokens: 10, modelId: 'm', durationMs: 1 })
        .mockResolvedValueOnce({ content: '', inputTokens: 50, outputTokens: 5, modelId: 'm', durationMs: 1 }),
    };
    const meter = new TokenMeter();
    const sut = new MeteringBedrockConverse(inner, meter);

    await sut.converse(request);
    await sut.converse(request);

    expect(meter.total).toBe(165);
  });
});

describe('MeteringBedrockEmbedder', () => {
  it('records the embedding input tokens (no output) and passes the vector through', async () => {
    const result = { embedding: [0.1, 0.2], inputTokens: 40 };
    const inner: IBedrockEmbedder = { embed: vi.fn().mockResolvedValue(result) };
    const meter = new TokenMeter();

    const out = await new MeteringBedrockEmbedder(inner, meter).embed('milk');

    expect(out).toBe(result);
    expect(meter.total).toBe(40);
  });
});
