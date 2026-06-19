import { describe, it, expect } from 'vitest';
import {
  categoryNameFor,
  depositCategoryFor,
  discountCategoryFor,
  isValidCategoryId,
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
});
