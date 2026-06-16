import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VisionParseService } from '@core/services/VisionParseService';
import type { BedrockSpendGuardService } from '@core/services/BedrockSpendGuardService';
import type { BedrockImage } from '@core/ports/IBedrockConverse';
import { SchemaValidationError } from '@core/domain/errors';

const VALID_JSON = JSON.stringify({
  merchant_raw: 'Albert Heijn',
  transaction_date: '2026-06-10',
  currency: 'EUR',
  total: 1.29,
  parse_confidence: 0.9,
  lines: [{ raw_text: 'Melk', quantity: 1, line_total: 1.29 }],
});

const converseResult = (content: string) => ({
  content,
  inputTokens: 10,
  outputTokens: 20,
  modelId: 'mock-model',
  durationMs: 5,
});

const image: BedrockImage = { format: 'jpeg', bytes: new Uint8Array([1, 2, 3]) };

describe('VisionParseService', () => {
  let callWithSpendGuard: ReturnType<typeof vi.fn>;
  let spendGuard: BedrockSpendGuardService;
  let sut: VisionParseService;

  beforeEach(() => {
    callWithSpendGuard = vi.fn();
    spendGuard = { callWithSpendGuard } as unknown as BedrockSpendGuardService;
    sut = new VisionParseService(spendGuard, 'mock-model', 'PROMPT', 'vision-parse/v1');
  });

  it('returns the parsed receipt on a valid first response', async () => {
    callWithSpendGuard.mockResolvedValue(converseResult(VALID_JSON));

    const receipt = await sut.parse('tenant-1', image);

    expect(receipt.merchantRaw).toBe('Albert Heijn');
    expect(callWithSpendGuard).toHaveBeenCalledTimes(1);
  });

  it('retries once with validation errors appended, then succeeds', async () => {
    callWithSpendGuard
      .mockResolvedValueOnce(converseResult('not json'))
      .mockResolvedValueOnce(converseResult(VALID_JSON));

    const receipt = await sut.parse('tenant-1', image);

    expect(receipt.total).toBe(1.29);
    expect(callWithSpendGuard).toHaveBeenCalledTimes(2);
    const retryMessages = callWithSpendGuard.mock.calls[1][1].messages as Array<{ content: string }>;
    expect(retryMessages.some(m => m.content.includes('validation_errors'))).toBe(true);
  });

  it('throws SchemaValidationError when both attempts fail validation', async () => {
    callWithSpendGuard.mockResolvedValue(converseResult('still not json'));

    await expect(sut.parse('tenant-1', image)).rejects.toBeInstanceOf(SchemaValidationError);
    expect(callWithSpendGuard).toHaveBeenCalledTimes(2);
  });
});
