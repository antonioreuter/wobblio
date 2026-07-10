import { describe, it, expect } from 'vitest';
import {
  categoryIdsUnderMacro,
  categoryNameFor,
  depositCategoryFor,
  discountCategoryFor,
  isValidCategoryId,
  macroCategoryId,
} from '@core/domain/categoryTaxonomy';

describe('categoryTaxonomy structural buckets', () => {
  it('maps a leaf to its macro deposit / discount bucket', () => {
    expect(depositCategoryFor('cat-beverages')).toBe('cat-groceries-deposit');
    expect(discountCategoryFor('cat-skincare')).toBe('cat-personal-care-discount');
  });

  it('maps a macro id directly to its own bucket', () => {
    expect(depositCategoryFor('cat-groceries')).toBe('cat-groceries-deposit');
    expect(discountCategoryFor('cat-hardware')).toBe('cat-hardware-discount');
  });

  it('falls back to cat-other when the category is null or unknown', () => {
    expect(depositCategoryFor(null)).toBe('cat-other-deposit');
    expect(discountCategoryFor('not-a-category')).toBe('cat-other-discount');
  });

  it('every deposit bucket it can return is a valid category id', () => {
    expect(isValidCategoryId('cat-groceries-deposit')).toBe(true);
    expect(isValidCategoryId('cat-other-deposit')).toBe(true);
  });

  it('resolves a category id to its display name and null for unknown/null ids', () => {
    expect(categoryNameFor('cat-personal-care')).toBe('Personal Care & Pharmacy');
    expect(categoryNameFor('not-a-category')).toBeNull();
    expect(categoryNameFor(null)).toBeNull();
  });

  it('collects a macro id plus every leaf under it', () => {
    const ids = categoryIdsUnderMacro('cat-personal-care');
    expect(ids).toContain('cat-personal-care');
    expect(ids).toContain('cat-pharmacy');
    expect(ids).toContain('cat-skincare');
    expect(ids).not.toContain('cat-groceries');
  });

  it('returns just the id itself for a macro with no leaves', () => {
    expect(categoryIdsUnderMacro('not-a-category')).toEqual(['not-a-category']);
  });

  it('rolls venue content leaves up to their macro (fixes/08)', () => {
    expect(macroCategoryId('cat-dining-meals')).toBe('cat-dining-out');
    expect(macroCategoryId('cat-dining-drinks')).toBe('cat-dining-out');
    expect(macroCategoryId('cat-dining-snacks')).toBe('cat-dining-out');
    expect(macroCategoryId('cat-bar-drinks')).toBe('cat-bars-pubs');
    expect(macroCategoryId('cat-bar-food')).toBe('cat-bars-pubs');
  });

  it('venue content leaves are valid category ids and collected under their macro', () => {
    for (const id of ['cat-dining-meals', 'cat-dining-drinks', 'cat-dining-snacks', 'cat-bar-drinks', 'cat-bar-food']) {
      expect(isValidCategoryId(id)).toBe(true);
    }
    expect(categoryIdsUnderMacro('cat-dining-out')).toContain('cat-dining-meals');
    expect(categoryIdsUnderMacro('cat-bars-pubs')).toContain('cat-bar-food');
  });
});
