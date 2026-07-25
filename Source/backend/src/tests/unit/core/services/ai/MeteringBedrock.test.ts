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

  // ProductNormalizer embeds concurrently (fix 07/04 §1), so the charge the worker bills off this
  // meter depends on interleaved calls not losing updates. TokenMeter.record is synchronous, so
  // no two updates can interleave — this pins that, because a future `await` inside record()
  // would silently start under-charging.
  it('loses no tokens when many embeddings resolve concurrently and out of order', async () => {
    const inner: IBedrockEmbedder = {
      embed: vi.fn().mockImplementation(async (text: string) => {
        const n = Number(text);
        await new Promise((r) => setTimeout(r, (20 - n) % 7));
        return { embedding: [n], inputTokens: 10 };
      }),
    };
    const meter = new TokenMeter();
    const sut = new MeteringBedrockEmbedder(inner, meter);

    await Promise.all(Array.from({ length: 20 }, (_, i) => sut.embed(String(i))));

    expect(meter.total).toBe(200);
    expect(meter.inputTotal).toBe(200);
    expect(meter.outputTotal).toBe(0);
    expect(meter.stageBreakdown()).toEqual([{ stage: 'EMBEDDING', inputTokens: 200, outputTokens: 0 }]);
  });
});
