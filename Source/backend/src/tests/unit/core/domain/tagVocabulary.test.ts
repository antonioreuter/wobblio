import { describe, it, expect } from 'vitest';
import { tagLabelFor } from '@core/domain/tagVocabulary';

describe('tagLabelFor', () => {
  it('resolves a known tag key to its display label', () => {
    expect(tagLabelFor('weekly-groceries')).toBe('Weekly groceries');
  });

  it('falls back to the raw key for an unknown tag', () => {
    expect(tagLabelFor('frozen-foods')).toBe('frozen-foods');
  });
});
