import { describe, it, expect } from 'vitest';
import { isResettableDatabase, computeTruncateList, PRESERVE_TABLES } from '../src/local/reset-dev';

describe('reset-dev guard: isResettableDatabase', () => {
  it('refuses the prod database (no dev/local marker)', () => {
    expect(isResettableDatabase('wobblio')).toBe(false);
  });

  it('allows the stage-isolated dev and local databases', () => {
    expect(isResettableDatabase('wobblio_dev')).toBe(true);
    expect(isResettableDatabase('wobblio_local')).toBe(true);
  });

  it('matches the dev/local token regardless of position or case', () => {
    expect(isResettableDatabase('DEV_wobblio')).toBe(true);
    expect(isResettableDatabase('wobblio-dev-eu')).toBe(true);
    expect(isResettableDatabase('Wobblio_LOCAL')).toBe(true);
  });

  it('does not match an incidental substring (devotion is not dev)', () => {
    expect(isResettableDatabase('devotion')).toBe(false);
    expect(isResettableDatabase('wobblio_development')).toBe(false);
  });
});

describe('reset-dev: computeTruncateList', () => {
  const allTables = [
    'app_user', 'pgmigrations', 'limits', 'system_counter', 'fx_rate', 'payment_transaction',
    'invoice', 'invoice_line', 'merchant', 'product', 'price_observation', 'country', 'product_category',
  ];

  it('truncates everything except the preserve allowlist', () => {
    const result = computeTruncateList(allTables, PRESERVE_TABLES);
    for (const t of PRESERVE_TABLES) expect(result).not.toContain(t);
    expect(result).toEqual(
      ['country', 'invoice', 'invoice_line', 'merchant', 'price_observation', 'product', 'product_category'],
    );
  });

  it('wipes a new table by default (allowlist, not blocklist)', () => {
    const result = computeTruncateList([...allTables, 'some_future_table'], PRESERVE_TABLES);
    expect(result).toContain('some_future_table');
  });

  it('returns nothing when only preserved tables exist', () => {
    expect(computeTruncateList([...PRESERVE_TABLES], PRESERVE_TABLES)).toEqual([]);
  });
});
