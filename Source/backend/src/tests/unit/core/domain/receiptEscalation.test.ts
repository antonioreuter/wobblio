import { describe, it, expect } from 'vitest';
import { decideReceiptEscalation, isRetakeSuggested } from '@core/domain/receiptEscalation';
import { DEFAULT_ESCALATION_THRESHOLDS } from '@core/domain/visionEscalation';
import { isArithmeticConsistent, type ParsedReceipt, type UnreadableVerdict } from '@core/domain/ingestion';

const T = DEFAULT_ESCALATION_THRESHOLDS;
const decide = (parsed: ParsedReceipt | UnreadableVerdict) => decideReceiptEscalation(parsed, T);

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

describe('decideReceiptEscalation', () => {
  it('does not escalate a clean, reconciled, high-confidence parse', () => {
    expect(decide(cleanReceipt())).toMatchObject({ tier: 'NONE' });
  });

  it('escalates a BLURRY verdict to the mid tier but not NOT_A_RECEIPT', () => {
    expect(decide({ unreadable: true, reason: 'BLURRY' } as UnreadableVerdict)).toEqual({ tier: 'FALLBACK', reason: 'BLURRY' });
    expect(decide({ unreadable: true, reason: 'NOT_A_RECEIPT' } as UnreadableVerdict)).toEqual({ tier: 'NONE' });
  });

  it('escalates a non-reconciling parse to the DEEP tier (reason ARITHMETIC)', () => {
    const r = cleanReceipt();
    r.total = 99.99; // lines sum to 5.23 — collapses reconciliation to 0
    expect(decide(r)).toMatchObject({ tier: 'FALLBACK_DEEP', reason: 'ARITHMETIC' });
  });

  it('escalates a low-confidence (but reconciled) parse to the mid tier', () => {
    const r = cleanReceipt();
    r.parseConfidence = 0.8; // in [deepMax 0.55, acceptMin 0.88)
    expect(decide(r)).toMatchObject({ tier: 'FALLBACK', reason: 'LOW_CONFIDENCE' });
  });

  it('escalates on poor coverage of the printed item count (reason COVERAGE)', () => {
    const r = cleanReceipt();
    r.statedItemCount = 12; // only 2 lines parsed → coverage 2/12 ≈ 0.17 → deep tier
    expect(decide(r)).toMatchObject({ tier: 'FALLBACK_DEEP', reason: 'COVERAGE' });
  });

  it('floors escalation to the mid tier on a fabricated sub-cent multi-buy even when the score is clean', () => {
    // qty 2 @ 0.625 = 1.25: reconciles and is high-confidence, but 0.625 betrays a line_total ÷
    // quantity fabrication (the silent jumbo_2 failure) — the score alone would accept it.
    const r: ParsedReceipt = {
      merchantRaw: 'Jumbo', transactionDate: '2026-07-03', currency: 'EUR', total: 5.23, parseConfidence: 0.97,
      lines: [
        { rawText: 'JUMBO ICE TEA PEACH', quantity: 2, lineTotal: 1.25, unitPrice: 0.625 },
        { rawText: 'PROT AARDBEI DRINK', quantity: 1, lineTotal: 3.98 },
      ],
    };
    expect(decide(r)).toMatchObject({ tier: 'FALLBACK', reason: 'SUSPECT_MULTIBUY' });
  });

  it('does not flag a genuine whole-cent multi-buy as suspect', () => {
    expect(decide(cleanReceipt())).toMatchObject({ tier: 'NONE' });
  });

  it('returns the blended score breakdown for parsed receipts (telemetry)', () => {
    const decision = decide(cleanReceipt());
    expect(decision.score).toMatchObject({ blended: expect.any(Number), reconciliationScore: expect.any(Number) });
  });
});

describe('isRetakeSuggested (Layer C)', () => {
  it('does not suggest a retake for a clean, reconciling parse', () => {
    expect(isRetakeSuggested(cleanReceipt(), T)).toBe(false);
  });

  it('does not suggest a retake for a merely low-confidence parse (that is review, not retake)', () => {
    const r = cleanReceipt();
    r.parseConfidence = 0.3; // reconciles → keepable; low confidence alone is not a retake
    expect(isRetakeSuggested(r, T)).toBe(false);
  });

  it('does not retake a correctable receipt just over the arithmetic tolerance (goes to review)', () => {
    const r = cleanReceipt();
    r.total = 5.39; // lines sum 5.23 → ~3% residual: not consistent, but well under retakeResidualPct
    expect(isArithmeticConsistent(r)).toBe(false); // would be NEEDS_REVIEW, not PARSED
    expect(isRetakeSuggested(r, T)).toBe(false); // and NOT discarded as retake
  });

  it('does not retake on a coverage shortfall when the parse reconciles (mis-read item count)', () => {
    const r = cleanReceipt();
    r.statedItemCount = 60; // a mis-read stated count on an otherwise-correct, reconciling parse
    expect(isRetakeSuggested(r, T)).toBe(false); // coverage is not a retake trigger — keep the data
  });

  it('suggests a retake only on a GROSS reconciliation failure (>= retakeResidualPct)', () => {
    const r = cleanReceipt();
    r.total = 99.99; // lines sum 5.23 → ~95% residual, far beyond the correctable band
    expect(isRetakeSuggested(r, T)).toBe(true);
  });

  it('treats a non-positive total as unreadable → retake', () => {
    const r = cleanReceipt();
    r.total = 0;
    expect(isRetakeSuggested(r, T)).toBe(true);
  });
});
