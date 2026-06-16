import { describe, it, expect } from 'vitest';
import { parseClassificationTiebreakJson } from '@core/domain/classificationTiebreakSchema';

describe('parseClassificationTiebreakJson', () => {
  it('accepts a known category id', () => {
    expect(parseClassificationTiebreakJson('{"category_id":"cat-groceries"}')).toEqual({
      ok: true,
      value: { categoryId: 'cat-groceries' },
    });
  });

  it('extracts JSON from a code fence', () => {
    expect(parseClassificationTiebreakJson('```\n{"category_id":"cat-dairy"}\n```').ok).toBe(true);
  });

  it('rejects invalid JSON', () => {
    expect(parseClassificationTiebreakJson('{')).toEqual({ ok: false, issues: 'output is not valid JSON' });
  });

  it('rejects non-object JSON', () => {
    expect(parseClassificationTiebreakJson('"x"')).toEqual({ ok: false, issues: 'output must be a JSON object' });
  });

  it('rejects a non-string category_id', () => {
    expect(parseClassificationTiebreakJson('{"category_id":5}')).toEqual({ ok: false, issues: 'category_id must be a string' });
  });

  it('rejects an unknown category id', () => {
    const result = parseClassificationTiebreakJson('{"category_id":"cat-nope"}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain('not a known category');
  });
});
