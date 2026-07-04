import { describe, it, expect } from 'vitest';
import { shouldEscalate } from '@core/domain/receiptEscalation';
import type { ParsedReceipt, UnreadableVerdict } from '@core/domain/ingestion';

// A clean, reconciled, high-confidence receipt with only whole-cent unit prices.
const cleanReceipt = (): ParsedReceipt => ({
  merchantRaw: 'Jumbo',
  transactionDate: '2026-07-03',
  currency: 'EUR',
  total: 5.23,
  parseConfidence: 0.97,
  lines: [
    { rawText: 'ICE TEA', quantity: 1, lineTotal: 1.25 },
    { rawText: 'AARDBEI DRINK', quantity: 2, lineTotal: 3.98, unitPrice: 1.99 },
  ],
});

describe('shouldEscalate', () => {
  it('does not escalate a clean, reconciled, high-confidence parse', () => {
    expect(shouldEscalate(cleanReceipt())).toEqual({ escalate: false });
  });

  it('escalates a BLURRY verdict but not NOT_A_RECEIPT', () => {
    expect(shouldEscalate({ unreadable: true, reason: 'BLURRY' } as UnreadableVerdict))
      .toEqual({ escalate: true, reason: 'BLURRY' });
    expect(shouldEscalate({ unreadable: true, reason: 'NOT_A_RECEIPT' } as UnreadableVerdict))
      .toEqual({ escalate: false });
  });

  it('escalates when Σ line items do not reconcile with the total', () => {
    const r = cleanReceipt();
    r.total = 99.99; // lines sum to 5.23 — well outside tolerance
    expect(shouldEscalate(r)).toEqual({ escalate: true, reason: 'ARITHMETIC' });
  });

  it('escalates when parse_confidence is below the escalation floor', () => {
    const r = cleanReceipt();
    r.parseConfidence = 0.8;
    expect(shouldEscalate(r)).toEqual({ escalate: true, reason: 'LOW_CONFIDENCE' });
  });

  it('escalates a multi-buy line whose unit price has sub-cent precision (fabricated)', () => {
    // qty 2 @ 0.625 = 1.25 total: reconciles and is high-confidence, but 0.625 betrays a
    // line_total ÷ quantity fabrication — the silent jumbo_2 failure.
    const r: ParsedReceipt = {
      merchantRaw: 'Jumbo', transactionDate: '2026-07-03', currency: 'EUR', total: 5.23, parseConfidence: 0.97,
      lines: [
        { rawText: 'JUMBO ICE TEA PEACH', quantity: 2, lineTotal: 1.25, unitPrice: 0.625 },
        { rawText: 'PROT AARDBEI DRINK', quantity: 1, lineTotal: 3.98 },
      ],
    };
    expect(shouldEscalate(r)).toEqual({ escalate: true, reason: 'SUSPECT_MULTIBUY' });
  });

  it('does not flag a genuine whole-cent multi-buy as suspect', () => {
    // qty 2 @ 1.99 = 3.98 — a real multi-buy; must not escalate.
    expect(shouldEscalate(cleanReceipt())).toEqual({ escalate: false });
  });
});
