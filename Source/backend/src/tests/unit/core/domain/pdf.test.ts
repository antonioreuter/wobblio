import { describe, it, expect } from 'vitest';
import { countPdfPages } from '@core/domain/pdf';

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('countPdfPages', () => {
  it('counts each page object, ignoring the /Pages tree node', () => {
    const pdf = bytes('<< /Type /Pages /Count 2 >> << /Type /Page >> << /Type/Page >>');
    expect(countPdfPages(pdf)).toBe(2);
  });

  it('tolerates spacing variants between /Type and /Page', () => {
    expect(countPdfPages(bytes('/Type /Page /Type/Page /Type  /Page'))).toBe(3);
  });

  it('returns 0 for empty input', () => {
    expect(countPdfPages(new Uint8Array(0))).toBe(0);
  });

  it('returns at least 1 for a non-empty input with no detectable page objects', () => {
    // Compressed/object-stream PDFs can hide page objects — undercount to 1 (never reject).
    expect(countPdfPages(bytes('%PDF-1.7 binary junk with no plain page markers'))).toBe(1);
  });

  it('does not count /Pages as a page', () => {
    expect(countPdfPages(bytes('<< /Type /Pages /Count 5 >>'))).toBe(1);
  });
});
