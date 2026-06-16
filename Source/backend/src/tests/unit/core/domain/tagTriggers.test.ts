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
  it('matches a category trigger off the invoice category', () => {
    expect(generateTags(ctx({ categoryId: 'cat-snacks' }))).toContain('snacks');
  });

  it('matches a min-spend-share trigger when the share clears the threshold', () => {
    expect(generateTags(ctx({ categoryShares: { 'cat-groceries': 0.6 } }))).toContain('weekly-groceries');
  });

  it('skips a min-spend-share trigger when the share is below the threshold', () => {
    expect(generateTags(ctx({ categoryShares: { 'cat-groceries': 0.5 } }))).not.toContain('weekly-groceries');
  });

  it('matches a category trigger via line spend share', () => {
    expect(generateTags(ctx({ categoryShares: { 'cat-dairy': 0.2 } }))).toContain('dairy');
  });

  it('matches a merchant-brand trigger', () => {
    expect(generateTags(ctx({ merchantBrand: 'Jumbo' }))).toContain('supermarket-jumbo');
  });

  it('does not match a brand trigger for a different merchant', () => {
    expect(generateTags(ctx({ merchantBrand: 'Aldi' }))).not.toContain('supermarket-jumbo');
  });

  it('accepts LLM-suggested keys from the vocabulary and rejects unknown ones', () => {
    const tags = generateTags(ctx({ suggestedTags: ['organic', 'not-a-real-tag'] }));
    expect(tags).toContain('organic');
    expect(tags).not.toContain('not-a-real-tag');
  });

  it('dedupes deterministic and suggested overlap', () => {
    const tags = generateTags(ctx({ categoryId: 'cat-snacks', suggestedTags: ['snacks'] }));
    expect(tags.filter(t => t === 'snacks')).toHaveLength(1);
  });

  it('caps the result at three tags', () => {
    const tags = generateTags(
      ctx({
        categoryId: 'cat-dining-out',
        categoryShares: { 'cat-dairy': 0.5, 'cat-produce': 0.5, 'cat-snacks': 0.5, 'cat-beverages': 0.5 },
      }),
    );
    expect(tags.length).toBeLessThanOrEqual(3);
  });
});
