import { describe, it, expect } from 'vitest';
import { generateTags, type TagGenerationContext } from '@core/domain/tagTriggers';

const ctx = (overrides: Partial<TagGenerationContext> = {}): TagGenerationContext => ({
  categoryId: null,
  merchantBrand: null,
  categoryShares: {},
  suggestedTags: [],
  ...overrides,
});

describe('generateTags', () => {
  it('matches a macro-category trigger off the invoice category', () => {
    expect(generateTags(ctx({ categoryId: 'cat-dining-out' }))).toContain('dining-out');
  });

  it('matches a min-spend-share trigger when the share clears the threshold', () => {
    expect(generateTags(ctx({ categoryShares: { 'cat-groceries': 0.6 } }))).toContain('weekly-groceries');
  });

  it('skips a min-spend-share trigger when the share is below the threshold', () => {
    expect(generateTags(ctx({ categoryShares: { 'cat-groceries': 0.5 } }))).not.toContain('weekly-groceries');
  });

  it('matches a macro-category trigger via line spend share', () => {
    expect(generateTags(ctx({ categoryShares: { 'cat-household': 0.2 } }))).toContain('household');
  });

  it('matches a merchant-brand trigger', () => {
    expect(generateTags(ctx({ merchantBrand: 'Jumbo' }))).toContain('supermarket-jumbo');
  });

  it('does not match a brand trigger for a different merchant', () => {
    expect(generateTags(ctx({ merchantBrand: 'Aldi' }))).not.toContain('supermarket-jumbo');
  });

  it('accepts LLM-suggested keys from the vocabulary and rejects unknown ones', () => {
    const tags = generateTags(ctx({ suggestedTags: ['groceries', 'not-a-real-tag'] }));
    expect(tags).toContain('groceries');
    expect(tags).not.toContain('not-a-real-tag');
  });

  it('dedupes deterministic and suggested overlap', () => {
    const tags = generateTags(ctx({ categoryId: 'cat-dining-out', suggestedTags: ['dining-out'] }));
    expect(tags.filter(t => t === 'dining-out')).toHaveLength(1);
  });

  it('caps the result at three tags', () => {
    const tags = generateTags(
      ctx({
        merchantBrand: 'Albert Heijn',
        categoryId: 'cat-groceries',
        categoryShares: { 'cat-groceries': 0.6, 'cat-household': 0.5, 'cat-dining-out': 0.5 },
      }),
    );
    expect(tags.length).toBeLessThanOrEqual(3);
  });
});
