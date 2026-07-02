import { describe, it, expect } from 'vitest';
import { toCsv } from '@core/domain/csv';

describe('toCsv', () => {
  it('renders a header row plus one row per record', () => {
    const csv = toCsv(['id', 'name'], [{ id: '1', name: 'Melk' }, { id: '2', name: 'Brood' }]);
    expect(csv).toBe('id,name\r\n1,Melk\r\n2,Brood');
  });

  it('quotes a field containing a comma', () => {
    const csv = toCsv(['name'], [{ name: 'Albert, Heijn' }]);
    expect(csv).toBe('name\r\n"Albert, Heijn"');
  });

  it('quotes a field containing a newline', () => {
    const csv = toCsv(['note'], [{ note: 'line1\nline2' }]);
    expect(csv).toBe('note\r\n"line1\nline2"');
  });

  it('doubles an embedded quote and wraps the field in quotes', () => {
    const csv = toCsv(['note'], [{ note: 'she said "hi"' }]);
    expect(csv).toBe('note\r\n"she said ""hi"""');
  });

  it('renders null and undefined as an empty field', () => {
    const csv = toCsv(['a', 'b'], [{ a: null, b: undefined }]);
    expect(csv).toBe('a,b\r\n,');
  });

  it('renders a Date as an ISO string', () => {
    const csv = toCsv(['createdAt'], [{ createdAt: new Date('2026-06-10T00:00:00.000Z') }]);
    expect(csv).toBe('createdAt\r\n2026-06-10T00:00:00.000Z');
  });

  it('renders just the header row for an empty row set', () => {
    expect(toCsv(['id'], [])).toBe('id');
  });
});
