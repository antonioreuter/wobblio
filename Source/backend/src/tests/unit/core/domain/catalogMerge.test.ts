import { describe, it, expect } from 'vitest';
import { mergeBlockReason } from '@core/domain/catalogMerge';

describe('catalogMerge.mergeBlockReason', () => {
  it('allows a same-category, same-unit, high-similarity pair', () => {
    expect(mergeBlockReason({ categoryMatch: true, unitMatch: true, similarity: 0.9 })).toBeNull();
  });

  it('blocks on category mismatch first', () => {
    expect(mergeBlockReason({ categoryMatch: false, unitMatch: false, similarity: 0.1 })).toBe('category_mismatch');
  });

  it('blocks on unit mismatch when category matches', () => {
    expect(mergeBlockReason({ categoryMatch: true, unitMatch: false, similarity: 0.99 })).toBe('unit_mismatch');
  });

  it('blocks on low similarity when category and unit match', () => {
    expect(mergeBlockReason({ categoryMatch: true, unitMatch: true, similarity: 0.84 })).toBe('low_similarity');
  });

  it('the similarity floor (0.85) is inclusive', () => {
    expect(mergeBlockReason({ categoryMatch: true, unitMatch: true, similarity: 0.85 })).toBeNull();
  });

  it('treats a missing embedding (similarity 0) as too far apart', () => {
    expect(mergeBlockReason({ categoryMatch: true, unitMatch: true, similarity: 0 })).toBe('low_similarity');
  });
});
