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

  it('does not add a macro tag for a single off-category line', () => {
    // A lone Gamma line mis-normalized to cat-baby must not tag the hardware invoice.
    const tags = generateTags(ctx({ categoryId: 'cat-hardware', categoryShares: { 'cat-hardware': 0.8, 'cat-baby': 0.2 } }));
    expect(tags).toContain('hardware');
    expect(tags).not.toContain('baby-kids');
  });

  it('rolls a sub-category invoice category up to its macro tag', () => {
    expect(generateTags(ctx({ categoryId: 'cat-tools-hardware' }))).toContain('hardware');
  });

  it('matches a merchant-brand trigger', () => {
    expect(generateTags(ctx({ merchantBrand: 'Jumbo' }))).toContain('supermarket-jumbo');
  });

  it('does not match a brand trigger for a different merchant', () => {
    expect(generateTags(ctx({ merchantBrand: 'Aldi' }))).not.toContain('supermarket-jumbo');
  });

  it('matches a Brazilian per-brand supermarket trigger (accented brand)', () => {
    expect(generateTags(ctx({ merchantBrand: 'Pão de Açúcar' }))).toContain('supermarket-pao-de-acucar');
    expect(generateTags(ctx({ merchantBrand: 'Guanabara' }))).toContain('supermarket-guanabara');
  });

  it('tags Brazilian atacado chains as cash-and-carry, not supermarket', () => {
    const tags = generateTags(ctx({ merchantBrand: 'Atacadão' }));
    expect(tags).toContain('cash-and-carry');
    expect(tags.some(t => t.startsWith('supermarket-'))).toBe(false);
  });

  it('groups Brazilian farmácias under the shared drugstore tag', () => {
    expect(generateTags(ctx({ merchantBrand: 'Drogasil' }))).toContain('drugstore');
    expect(generateTags(ctx({ merchantBrand: 'Droga Raia' }))).toContain('drugstore');
  });

  it('matches shared type tags for non-grocery Brazilian retailers', () => {
    expect(generateTags(ctx({ merchantBrand: 'Zara' }))).toContain('fashion-retail');
    expect(generateTags(ctx({ merchantBrand: 'Fast Shop' }))).toContain('electronics-store');
    expect(generateTags(ctx({ merchantBrand: 'Amazon.com.br' }))).toContain('online-marketplace');
    expect(generateTags(ctx({ merchantBrand: 'Centauro' }))).toContain('sporting-goods');
    expect(generateTags(ctx({ merchantBrand: 'Havan' }))).toContain('department-store');
  });

  it('accepts LLM-suggested keys from the vocabulary and rejects unknown ones', () => {
    const tags = generateTags(ctx({ suggestedTags: ['groceries', 'not-a-real-tag'] }));
    expect(tags).toContain('groceries');
    expect(tags).not.toContain('not-a-real-tag');
  });

  it('rejects an LLM-suggested merchant-identity tag that the merchant does not match', () => {
    // Aldi receipt, LLM guesses supermarket-ah — must not stick (the real bug).
    const tags = generateTags(ctx({ merchantBrand: 'Aldi', suggestedTags: ['supermarket-ah'] }));
    expect(tags).not.toContain('supermarket-ah');
  });

  it('still emits a merchant-identity tag from the deterministic path when the brand matches', () => {
    const tags = generateTags(ctx({ merchantBrand: 'Albert Heijn', suggestedTags: ['supermarket-ah'] }));
    expect(tags).toEqual(['supermarket-ah']);
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
