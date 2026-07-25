import { describe, it, expect } from 'vitest';
import {
  rankCounterparts,
  COUNTERPART_MAX,
  type CounterpartCandidate,
} from '@core/domain/counterpartSuggestion';

const candidate = (over: Partial<CounterpartCandidate> & { productId: string }): CounterpartCandidate => ({
  embeddingSimilarity: null,
  nameSimilarity: 0,
  linked: false,
  ...over,
});

describe('rankCounterparts', () => {
  it('keeps candidates whose embedding cosine clears the floor and drops those below it', () => {
    const ranked = rankCounterparts([
      candidate({ productId: 'keep', embeddingSimilarity: 0.8 }),
      candidate({ productId: 'drop', embeddingSimilarity: 0.6 }),
    ]);
    expect(ranked.map((r) => r.productId)).toEqual(['keep']);
  });

  it('falls back to the name trigram score when no embedding is present', () => {
    const ranked = rankCounterparts([
      candidate({ productId: 'keep', nameSimilarity: 0.5 }),
      candidate({ productId: 'drop', nameSimilarity: 0.2 }),
    ]);
    expect(ranked.map((r) => r.productId)).toEqual(['keep']);
  });

  it('always surfaces a linked candidate first, even below the similarity floor', () => {
    const ranked = rankCounterparts([
      candidate({ productId: 'strong', embeddingSimilarity: 0.95 }),
      candidate({ productId: 'linked', embeddingSimilarity: 0.1, linked: true }),
    ]);
    expect(ranked[0].productId).toBe('linked');
    expect(ranked[0].linked).toBe(true);
    expect(ranked.map((r) => r.productId)).toEqual(['linked', 'strong']);
  });

  it('orders unlinked candidates by descending similarity', () => {
    const ranked = rankCounterparts([
      candidate({ productId: 'mid', embeddingSimilarity: 0.8 }),
      candidate({ productId: 'top', embeddingSimilarity: 0.9 }),
    ]);
    expect(ranked.map((r) => r.productId)).toEqual(['top', 'mid']);
  });

  it('caps the result at COUNTERPART_MAX', () => {
    const many = Array.from({ length: COUNTERPART_MAX + 3 }, (_, i) =>
      candidate({ productId: `p${i}`, embeddingSimilarity: 0.9 }),
    );
    expect(rankCounterparts(many)).toHaveLength(COUNTERPART_MAX);
  });
});
