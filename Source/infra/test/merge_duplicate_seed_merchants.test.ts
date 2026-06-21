import { describe, it, expect } from 'vitest';
import { MERCHANT_SEEDS as MERGE_SEEDS, normalizeAlias as mergeNormalize } from '../src/migrations/20260621140000_merge_duplicate_seed_merchants';
import { MERCHANT_SEEDS as CANONICAL_SEEDS, normalizeAlias as canonicalNormalize } from '../src/migrations/20260620120000_seed_merchants';

// The merge migration re-declares the seed snapshot (node-pg-migrate cannot resolve a
// sibling-migration import). These tests pin that copy to the canonical seed_merchants
// snapshot so a brand added there without updating the merge map can never silently stop
// being de-duplicated.

const mergeKey = (m: { id: string; country_code: string; aliases: string[] }) =>
  `${m.id}|${m.country_code}|${[...m.aliases].sort().join(',')}`;

describe('merge snapshot vs canonical seed', () => {
  it('covers the same id, country, and aliases for every merchant', () => {
    const fromMerge = MERGE_SEEDS.map(mergeKey).sort();
    const fromCanonical = CANONICAL_SEEDS.map(mergeKey).sort();
    expect(fromMerge).toEqual(fromCanonical);
  });

  it('normalizes aliases identically to the canonical seed', () => {
    for (const alias of MERGE_SEEDS.flatMap((m) => m.aliases)) {
      expect(mergeNormalize(alias)).toBe(canonicalNormalize(alias));
    }
  });
});
