import { describe, it, expect } from 'vitest';
import { parseUnitSize, computeNormalizedUnitPrice, roundTo } from '@core/domain/unitSize';

describe('parseUnitSize', () => {
  it('returns null for empty input', () => {
    expect(parseUnitSize(undefined)).toBeNull();
    expect(parseUnitSize(null)).toBeNull();
    expect(parseUnitSize('')).toBeNull();
  });

  it('parses grams into kilograms', () => {
    expect(parseUnitSize('500G')).toEqual({ packQuantity: 0.5, baseUnit: 'KG' });
  });

  it('parses kilograms', () => {
    expect(parseUnitSize('1KG')).toEqual({ packQuantity: 1, baseUnit: 'KG' });
  });

  it('parses litres and sub-litre units', () => {
    expect(parseUnitSize('1L')).toEqual({ packQuantity: 1, baseUnit: 'L' });
    expect(parseUnitSize('500ML')).toEqual({ packQuantity: 0.5, baseUnit: 'L' });
    expect(parseUnitSize('33CL')).toEqual({ packQuantity: 0.33, baseUnit: 'L' });
    expect(parseUnitSize('2DL')).toEqual({ packQuantity: 0.2, baseUnit: 'L' });
  });

  it('parses a decimal amount with comma', () => {
    expect(parseUnitSize('1,5L')).toEqual({ packQuantity: 1.5, baseUnit: 'L' });
  });

  it('parses piece counts', () => {
    expect(parseUnitSize('12 stuks')).toEqual({ packQuantity: 12, baseUnit: 'PIECE' });
  });

  it('parses a multipack', () => {
    expect(parseUnitSize('6X33CL')).toEqual({ packQuantity: 1.98, baseUnit: 'L' });
  });

  it('returns null for an unparseable single unit', () => {
    expect(parseUnitSize('5FOO')).toBeNull();
  });

  it('returns null for a non-matching string', () => {
    expect(parseUnitSize('abc')).toBeNull();
  });

  it('returns null for a zero amount', () => {
    expect(parseUnitSize('0G')).toBeNull();
  });

  it('returns null for a multipack with a zero count', () => {
    expect(parseUnitSize('0X33CL')).toBeNull();
  });

  it('returns null for a multipack with an unparseable single', () => {
    expect(parseUnitSize('6XFOO')).toBeNull();
  });
});

describe('computeNormalizedUnitPrice', () => {
  it('computes price per base unit', () => {
    expect(computeNormalizedUnitPrice(3, 2, 0.5)).toBe(3);
  });

  it('returns null when pack quantity is null', () => {
    expect(computeNormalizedUnitPrice(3, 1, null)).toBeNull();
  });

  it('returns null when pack quantity is non-positive', () => {
    expect(computeNormalizedUnitPrice(3, 1, -1)).toBeNull();
  });

  it('returns null when quantity is non-positive', () => {
    expect(computeNormalizedUnitPrice(3, 0, 1)).toBeNull();
  });

  it('returns null when line total is non-positive', () => {
    expect(computeNormalizedUnitPrice(-3, 1, 1)).toBeNull();
  });
});

describe('roundTo', () => {
  it('rounds to the requested decimals', () => {
    expect(roundTo(1.23456, 4)).toBe(1.2346);
  });
});
