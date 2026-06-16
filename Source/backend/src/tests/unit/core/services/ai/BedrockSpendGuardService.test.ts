import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { BedrockSpendGuardService, estimateCostEur } from '@core/services/ai/BedrockSpendGuardService';
import type { IBedrockConverse } from '@core/ports/ai/IBedrockConverse';
import type { IAiSpendLedger } from '@core/ports/ai/IAiSpendLedger';
import type { IAiSpendCapProvider } from '@core/ports/ai/IAiSpendCapProvider';
import { AiSpendCapExceededError } from '@core/domain/errors';

const makeRequest = () => ({
  modelId: 'mock-model',
  stage: 'VISION_PARSE' as const,
  messages: [{ role: 'user' as const, content: 'parse receipt' }],
  promptVersion: 'v1',
});

describe('estimateCostEur', () => {
  it('returns 0 for zero input and output tokens', () => {
    expect(estimateCostEur(0, 0)).toBe(0);
  });

  it('applies correct per-token rates for known token counts', () => {
    // 500 input × 0.00025/1k + 200 output × 0.00125/1k = 0.000125 + 0.00025
    expect(estimateCostEur(500, 200)).toBeCloseTo(0.000375, 8);
  });
});

describe('BedrockSpendGuardService', () => {
  let mockConverse: MockedObject<IBedrockConverse>;
  let mockLedger: MockedObject<IAiSpendLedger>;
  let mockCap: MockedObject<IAiSpendCapProvider>;
  let sut: BedrockSpendGuardService;

  beforeEach(() => {
    mockConverse = { converse: vi.fn() };
    mockLedger = { record: vi.fn(), getDailyTotal: vi.fn() };
    mockCap = { getDailyCapEur: vi.fn() };
    sut = new BedrockSpendGuardService(mockConverse, mockLedger, mockCap);
  });

  it('throws AiSpendCapExceededError when spend equals cap', async () => {
    mockLedger.getDailyTotal.mockResolvedValue(0.10);
    mockCap.getDailyCapEur.mockResolvedValue(0.10);

    await expect(sut.callWithSpendGuard('tenant-abc', makeRequest()))
      .rejects.toBeInstanceOf(AiSpendCapExceededError);
  });

  it('returns the converse result when spend is below cap', async () => {
    const converseResult = { content: '{}', inputTokens: 500, outputTokens: 200, modelId: 'mock-model', durationMs: 800 };
    mockLedger.getDailyTotal.mockResolvedValue(0.05);
    mockCap.getDailyCapEur.mockResolvedValue(0.10);
    mockConverse.converse.mockResolvedValue(converseResult);
    mockLedger.record.mockResolvedValue(undefined);

    const result = await sut.callWithSpendGuard('tenant-abc', makeRequest());

    expect(result).toEqual(converseResult);
  });

  it('records spend with correct token counts and positive cost when call succeeds', async () => {
    const converseResult = { content: '{}', inputTokens: 500, outputTokens: 200, modelId: 'mock-model', durationMs: 800 };
    mockLedger.getDailyTotal.mockResolvedValue(0.05);
    mockCap.getDailyCapEur.mockResolvedValue(0.10);
    mockConverse.converse.mockResolvedValue(converseResult);
    mockLedger.record.mockResolvedValue(undefined);

    await sut.callWithSpendGuard('tenant-abc', makeRequest());

    expect(mockLedger.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-abc',
        inputTokens: 500,
        outputTokens: 200,
        estCost: estimateCostEur(500, 200),
      }),
    );
  });
});
