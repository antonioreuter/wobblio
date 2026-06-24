import { describe, it, expect } from 'vitest';
import { parseBedrockModel } from '@core/domain/bedrockUsageType';

describe('parseBedrockModel', () => {
  it.each([
    ['EU-Qwen3-VL-235B-A22B-input-tokens', 'Qwen3-VL-235B-A22B'],
    ['EU-Qwen3-VL-235B-A22B-output-tokens', 'Qwen3-VL-235B-A22B'],
    ['EU-TitanEmbeddingV2-Text-input-tokens', 'TitanEmbeddingV2-Text'],
    ['EU-Nova2.0Lite-input-tokens-cross-region-global', 'Nova2.0Lite'],
    ['EUW1-Claude-Haiku-output-tokens', 'Claude-Haiku'],
  ])('parses %s -> %s', (usageType, expected) => {
    expect(parseBedrockModel(usageType)).toBe(expected);
  });

  it('falls back to the raw string when nothing matches', () => {
    expect(parseBedrockModel('Tax')).toBe('Tax');
    expect(parseBedrockModel('')).toBe('');
  });
});
