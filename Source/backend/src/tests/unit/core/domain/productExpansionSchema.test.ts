import { describe, it, expect } from 'vitest';
import { parseProductExpansionJson } from '@core/domain/productExpansionSchema';

const oneItem = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    items: [
      {
        display_name: 'AH Halfvolle Melk 1L',
        category_id: 'cat-dairy',
        base_unit: 'L',
        pack_size_base_units: 1,
        is_deposit_or_fee: false,
        ...overrides,
      },
    ],
    suggested_tags: ['groceries'],
  });

describe('parseProductExpansionJson', () => {
  it('parses a valid item with suggested tags', () => {
    const result = parseProductExpansionJson(oneItem({ brand: 'Albert Heijn' }), 1);
    expect(result).toEqual({
      ok: true,
      value: {
        items: [{ displayName: 'AH Halfvolle Melk 1L', brand: 'Albert Heijn', categoryId: 'cat-dairy', baseUnit: 'L', packSizeBaseUnits: 1, isDepositOrFee: false }],
        suggestedTags: ['groceries'],
      },
    });
  });

  it('defaults a missing or empty brand to null', () => {
    const absent = parseProductExpansionJson(oneItem(), 1);
    const empty = parseProductExpansionJson(oneItem({ brand: '  ' }), 1);
    if (absent.ok) expect(absent.value.items[0].brand).toBeNull();
    if (empty.ok) expect(empty.value.items[0].brand).toBeNull();
  });

  it('rejects a non-string brand', () => {
    const result = parseProductExpansionJson(oneItem({ brand: 5 }), 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain('brand');
  });

  it('defaults missing suggested_tags to an empty array and null pack size', () => {
    const json = JSON.stringify({
      items: [{ display_name: 'Banana', category_id: 'cat-produce', base_unit: 'KG', is_deposit_or_fee: false }],
    });
    const result = parseProductExpansionJson(json, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.suggestedTags).toEqual([]);
      expect(result.value.items[0].packSizeBaseUnits).toBeNull();
    }
  });

  it('rejects invalid JSON', () => {
    expect(parseProductExpansionJson('nope', 1)).toEqual({ ok: false, issues: 'output is not valid JSON' });
  });

  it('rejects non-object JSON', () => {
    expect(parseProductExpansionJson('123', 1)).toEqual({ ok: false, issues: 'output must be a JSON object' });
  });

  it('rejects when items is not an array', () => {
    expect(parseProductExpansionJson('{"items":{}}', 1)).toEqual({ ok: false, issues: 'items must be an array' });
  });

  it('rejects a line-count mismatch', () => {
    const result = parseProductExpansionJson(oneItem(), 2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain('exactly 2 entries');
  });

  it('rejects non-string suggested_tags', () => {
    const json = JSON.stringify({ items: [], suggested_tags: [1] });
    expect(parseProductExpansionJson(json, 0)).toEqual({ ok: false, issues: 'suggested_tags must be an array of strings' });
  });

  it('rejects a non-object item', () => {
    const json = JSON.stringify({ items: [null] });
    const result = parseProductExpansionJson(json, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain('items[0] must be an object');
  });

  it('reports all field-level item issues', () => {
    const json = oneItem({
      display_name: '',
      category_id: 'cat-nope',
      base_unit: 'OZ',
      pack_size_base_units: 'x',
      is_deposit_or_fee: 'no',
    });
    const result = parseProductExpansionJson(json, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContain('display_name');
      expect(result.issues).toContain('category_id');
      expect(result.issues).toContain('base_unit');
      expect(result.issues).toContain('pack_size_base_units');
      expect(result.issues).toContain('is_deposit_or_fee');
    }
  });
});
