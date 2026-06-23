import { describe, it, expect } from 'vitest';
import { findTunable, normalizeTunableValue, TUNABLE_PARAMS } from '@core/domain/adminTunables';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';

describe('adminTunables', () => {
  it('exposes the five named tunables plus four model token ceilings', () => {
    const keys = TUNABLE_PARAMS.map((p) => p.key);
    expect(keys).toContain('max_free_users_cap');
    expect(keys).toContain('tags_vocabulary');
    expect(keys.filter((k) => k.startsWith('model_max_tokens_'))).toHaveLength(4);
  });

  it('throws UnknownAdminTargetError for a key outside the allowlist', () => {
    expect(() => findTunable('arbitrary/path')).toThrow(UnknownAdminTargetError);
  });

  it('coerces integers and enforces bounds', () => {
    const maxStores = findTunable('routing_max_stores'); // min 1, max 10
    expect(normalizeTunableValue(maxStores, '4')).toBe('4');
    expect(() => normalizeTunableValue(maxStores, 0)).toThrow(InvalidAdminInputError);
    expect(() => normalizeTunableValue(maxStores, 11)).toThrow(InvalidAdminInputError);
    expect(() => normalizeTunableValue(maxStores, 2.5)).toThrow(InvalidAdminInputError);
  });

  it('normalizes booleans to canonical strings', () => {
    const toggle = findTunable('tags_dedicated_call_enabled');
    expect(normalizeTunableValue(toggle, true)).toBe('true');
    expect(normalizeTunableValue(toggle, 'false')).toBe('false');
    expect(() => normalizeTunableValue(toggle, 'yes')).toThrow(InvalidAdminInputError);
  });

  it('compacts and validates JSON', () => {
    const vocab = findTunable('tags_vocabulary');
    expect(normalizeTunableValue(vocab, { a: 1 })).toBe('{"a":1}');
    expect(normalizeTunableValue(vocab, '{ "a": 1 }')).toBe('{"a":1}');
    expect(() => normalizeTunableValue(vocab, '{bad')).toThrow(InvalidAdminInputError);
  });

  it('rejects a JSON value that is neither object nor string', () => {
    const vocab = findTunable('tags_vocabulary');
    expect(() => normalizeTunableValue(vocab, 123)).toThrow(InvalidAdminInputError);
  });
});
