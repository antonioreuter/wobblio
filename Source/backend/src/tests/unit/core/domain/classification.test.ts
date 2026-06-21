import { describe, it, expect } from 'vitest';
import { voteCategory, categoryShares } from '@core/domain/classification';

describe('voteCategory', () => {
  it('flags a tiebreak when there are no lines', () => {
    expect(voteCategory([])).toEqual({ categoryId: null, topShare: 0, needsTiebreak: true });
  });

  it('ignores lines with no category', () => {
    expect(voteCategory([{ categoryId: null, lineTotal: 10 }])).toEqual({
      categoryId: null,
      topShare: 0,
      needsTiebreak: true,
    });
  });

  it('ignores zero-value lines', () => {
    const result = voteCategory([
      { categoryId: 'cat-groceries', lineTotal: 0 },
      { categoryId: 'cat-household', lineTotal: 5 },
    ]);
    expect(result.categoryId).toBe('cat-household');
  });

  it('picks the dominant category and clears the tiebreak above 50%', () => {
    const result = voteCategory([
      { categoryId: 'cat-groceries', lineTotal: 8 },
      { categoryId: 'cat-household', lineTotal: 2 },
    ]);
    expect(result).toEqual({ categoryId: 'cat-groceries', topShare: 0.8, needsTiebreak: false });
  });

  it('requires a tiebreak when no category exceeds 50%', () => {
    const result = voteCategory([
      { categoryId: 'cat-groceries', lineTotal: 5 },
      { categoryId: 'cat-household', lineTotal: 5 },
    ]);
    expect(result.categoryId).toBe('cat-groceries'); // first to reach the max
    expect(result.topShare).toBe(0.5);
    expect(result.needsTiebreak).toBe(true);
  });

  it('uses absolute totals so discounts do not skew the vote', () => {
    const result = voteCategory([
      { categoryId: 'cat-groceries', lineTotal: 9 },
      { categoryId: 'cat-groceries', lineTotal: -1 },
      { categoryId: 'cat-household', lineTotal: 2 },
    ]);
    expect(result.categoryId).toBe('cat-groceries');
  });

  it('excludes cat-other so an all-unknown receipt yields no winner (prior decides)', () => {
    // A bouwmarkt receipt whose SKUs the normalizer cannot place: every line is cat-other.
    // cat-other is the unknown bucket, not evidence — it must not win and bury the prior.
    const result = voteCategory([
      { categoryId: 'cat-other', lineTotal: 30 },
      { categoryId: 'cat-other-other', lineTotal: 20 },
    ]);
    expect(result).toEqual({ categoryId: null, topShare: 0, needsTiebreak: true });
  });

  it('lets a real category win over a cat-other majority by ignoring the unknown spend', () => {
    // cat-other is 60% of raw spend but is excluded; cat-hardware is the only real vote.
    const result = voteCategory([
      { categoryId: 'cat-other', lineTotal: 6 },
      { categoryId: 'cat-fasteners', lineTotal: 4 },
    ]);
    expect(result).toEqual({ categoryId: 'cat-hardware', topShare: 1, needsTiebreak: false });
  });

  it('rolls sub-categories up to their macro before voting', () => {
    const result = voteCategory([
      { categoryId: 'cat-dairy', lineTotal: 4 },
      { categoryId: 'cat-produce', lineTotal: 4 },
      { categoryId: 'cat-household', lineTotal: 2 },
    ]);
    // dairy + produce roll up to cat-groceries (8/10 = 0.8): a clear macro majority.
    expect(result).toEqual({ categoryId: 'cat-groceries', topShare: 0.8, needsTiebreak: false });
  });
});

describe('categoryShares', () => {
  it('returns an empty map when there is no categorized spend', () => {
    expect(categoryShares([{ categoryId: null, lineTotal: 10 }, { categoryId: 'cat-dairy', lineTotal: 0 }])).toEqual({});
  });

  it('rolls sub-category spend up into the parent macro share', () => {
    const shares = categoryShares([
      { categoryId: 'cat-dairy', lineTotal: 6 },
      { categoryId: 'cat-produce', lineTotal: 2 },
      { categoryId: 'cat-dairy', lineTotal: 2 },
    ]);
    // Leaf shares plus the rolled-up cat-groceries macro (all 10 of 10 are groceries).
    expect(shares).toEqual({ 'cat-dairy': 0.8, 'cat-produce': 0.2, 'cat-groceries': 1 });
  });

  it('does not duplicate the macro key for a line already at macro level', () => {
    expect(categoryShares([{ categoryId: 'cat-household', lineTotal: 5 }])).toEqual({ 'cat-household': 1 });
  });
});
