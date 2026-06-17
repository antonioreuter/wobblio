import { describe, it, expect } from 'vitest';
import { activeListLimit } from '@core/domain/shoppingList';

describe('activeListLimit', () => {
  it('caps STANDARD users at 3 active lists', () => {
    expect(activeListLimit('STANDARD')).toBe(3);
  });

  it('caps PREMIUM and other roles at 10 active lists', () => {
    expect(activeListLimit('PREMIUM')).toBe(10);
    expect(activeListLimit('ADMIN')).toBe(10);
  });
});
