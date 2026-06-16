import { describe, it, expect } from 'vitest';
import { parseReceiptJson } from '@core/domain/receiptSchema';

const validObject = () => ({
  merchant_raw: 'Albert Heijn',
  transaction_date: '2026-06-10',
  currency: 'eur',
  total: 12.5,
  document_kind_hint: 'GROCERY',
  parse_confidence: 0.95,
  lines: [
    { raw_text: 'Melk', quantity: 1, line_total: 1.29, unit_price: 1.29, unit_size_raw: '1L' },
  ],
});

const expectIssue = (content: string, fragment: string) => {
  const result = parseReceiptJson(content);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.issues).toContain(fragment);
};

describe('parseReceiptJson — success', () => {
  it('parses a valid receipt and uppercases the currency', () => {
    const result = parseReceiptJson(JSON.stringify(validObject()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.currency).toBe('EUR');
      expect(result.value.merchantRaw).toBe('Albert Heijn');
      expect(result.value.lines[0].unitSizeRaw).toBe('1L');
    }
  });

  it('parses a valid receipt with optional line fields omitted', () => {
    const obj = validObject();
    obj.lines = [{ raw_text: 'Brood', quantity: 2, line_total: 3.0 } as never];
    delete (obj as Record<string, unknown>).document_kind_hint;
    const result = parseReceiptJson(JSON.stringify(obj));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lines[0].unitPrice).toBeUndefined();
      expect(result.value.documentKindHint).toBeUndefined();
    }
  });

  it('extracts JSON wrapped in a ```json fence', () => {
    const result = parseReceiptJson('```json\n' + JSON.stringify(validObject()) + '\n```');
    expect(result.ok).toBe(true);
  });

  it('extracts JSON wrapped in surrounding prose', () => {
    const result = parseReceiptJson('Here is the receipt: ' + JSON.stringify(validObject()) + ' done.');
    expect(result.ok).toBe(true);
  });
});

describe('parseReceiptJson — top-level failures', () => {
  it('rejects non-JSON output', () => expectIssue('totally not json', 'not valid JSON'));
  it('rejects braces in the wrong order (no parseable object)', () => expectIssue('}{', 'not valid JSON'));
  it('rejects a JSON number', () => expectIssue('123', 'must be a JSON object'));
  it('rejects JSON null', () => expectIssue('null', 'must be a JSON object'));

  it('rejects a blank merchant_raw', () => expectIssue(JSON.stringify({ ...validObject(), merchant_raw: '' }), 'merchant_raw'));
  it('rejects a malformed transaction_date', () => expectIssue(JSON.stringify({ ...validObject(), transaction_date: '10-06-2026' }), 'transaction_date'));
  it('rejects a non-3-letter currency', () => expectIssue(JSON.stringify({ ...validObject(), currency: 'EU' }), 'currency'));
  it('rejects a non-numeric total', () => expectIssue(JSON.stringify({ ...validObject(), total: 'x' }), 'total'));
  it('rejects a non-numeric parse_confidence', () => expectIssue(JSON.stringify({ ...validObject(), parse_confidence: 'x' }), 'parse_confidence'));
  it('rejects parse_confidence above 1', () => expectIssue(JSON.stringify({ ...validObject(), parse_confidence: 1.5 }), 'parse_confidence'));
  it('rejects parse_confidence below 0', () => expectIssue(JSON.stringify({ ...validObject(), parse_confidence: -0.1 }), 'parse_confidence'));
  it('rejects a non-string document_kind_hint', () => expectIssue(JSON.stringify({ ...validObject(), document_kind_hint: 5 }), 'document_kind_hint'));
  it('rejects a non-array lines field', () => expectIssue(JSON.stringify({ ...validObject(), lines: 'x' }), 'lines'));
  it('rejects an empty lines array', () => expectIssue(JSON.stringify({ ...validObject(), lines: [] }), 'lines'));
});

describe('parseReceiptJson — line failures', () => {
  it('rejects a non-object line', () => {
    expectIssue(JSON.stringify({ ...validObject(), lines: [123] }), 'lines[0] must be an object');
  });

  it('rejects a line with every field invalid', () => {
    const bad = { raw_text: '', quantity: 'x', line_total: 'y', unit_price: 'z', unit_size_raw: 9 };
    const result = parseReceiptJson(JSON.stringify({ ...validObject(), lines: [bad] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContain('raw_text');
      expect(result.issues).toContain('quantity');
      expect(result.issues).toContain('line_total');
      expect(result.issues).toContain('unit_price');
      expect(result.issues).toContain('unit_size_raw');
    }
  });
});
