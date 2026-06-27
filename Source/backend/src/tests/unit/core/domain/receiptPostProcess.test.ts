import { describe, it, expect } from 'vitest';
import { dropNonItemLines, collapseContinuationLines } from '@core/domain/receiptPostProcess';
import type { ParsedReceipt } from '@core/domain/ingestion';

const base = (lines: ParsedReceipt['lines']): ParsedReceipt => ({
  merchantRaw: 'Albert Heijn 1179',
  transactionDate: '2026-06-10',
  currency: 'EUR',
  total: 14.35,
  lines,
  parseConfidence: 0.95,
});

describe('dropNonItemLines', () => {
  it('removes totals, loyalty, and metadata rows while keeping real items', () => {
    const receipt = base([
      { rawText: 'BONUSKAART xx5482', quantity: 1, lineTotal: 0 },
      { rawText: 'COCA-COLA', quantity: 1, lineTotal: 9.39 },
      { rawText: '+STATIEGELD', quantity: 1, lineTotal: 1.8 },
      { rawText: '40% K BRAADWORST', quantity: 1, lineTotal: -0.92 },
      { rawText: 'SUBTOTAAL', quantity: 1, lineTotal: 15.47 },
      { rawText: 'TOTAAL', quantity: 1, lineTotal: 14.35 },
      { rawText: 'BTW 9%', quantity: 1, lineTotal: 1.18 },
    ]);

    const cleaned = dropNonItemLines(receipt);

    expect(cleaned.lines.map(l => l.rawText)).toEqual([
      'COCA-COLA',
      '+STATIEGELD',
      '40% K BRAADWORST',
    ]);
  });

  it('drops promo-savings grand total but keeps inline KORTING discounts (tk_1 regression)', () => {
    const receipt = base([
      { rawText: 'ROLL ON NIVEA SUN', quantity: 2, lineTotal: 31.98, unitPrice: 15.99 },
      { rawText: 'KORTING 1+1 ZONBESCHERMING', quantity: 1, lineTotal: -15.99 },
      { rawText: 'GUMMIES VITAMINE', quantity: 2, lineTotal: 35.98, unitPrice: 17.99 },
      { rawText: 'KORTING 1+1 LUCOVITAAL', quantity: 1, lineTotal: -17.99 },
      { rawText: 'TOTALE ACTIEKORTING', quantity: 1, lineTotal: -33.98 },
    ]);

    const cleaned = dropNonItemLines(receipt);

    expect(cleaned.lines.map(l => l.rawText)).toEqual([
      'ROLL ON NIVEA SUN',
      'KORTING 1+1 ZONBESCHERMING',
      'GUMMIES VITAMINE',
      'KORTING 1+1 LUCOVITAAL',
    ]);
  });

  it('keeps a deposit line and does not touch amounts', () => {
    const receipt = base([{ rawText: 'STATIEGELD', quantity: 1, lineTotal: 1.8 }]);
    expect(dropNonItemLines(receipt).lines).toHaveLength(1);
  });

  it('returns the same reference when nothing matches', () => {
    const receipt = base([{ rawText: 'MELK', quantity: 1, lineTotal: 1.29 }]);
    expect(dropNonItemLines(receipt)).toBe(receipt);
  });
});

describe('collapseContinuationLines', () => {
  it('folds a duplicate-total breakdown into the product above (jumbo tk regression)', () => {
    // JUMBO ACHTERHAM FLIN 5.02 followed by "2 X 2,51" 5.02 — both 5.02, double-counted.
    const receipt = base([
      { rawText: 'JUMBO ACHTERHAM FLIN', quantity: 1, lineTotal: 5.02 },
      { rawText: '2 X 2,51', quantity: 2, lineTotal: 5.02, unitPrice: 2.51 },
    ]);

    const collapsed = collapseContinuationLines(receipt);

    expect(collapsed.lines).toEqual([
      { rawText: 'JUMBO ACHTERHAM FLIN', quantity: 2, lineTotal: 5.02, unitPrice: 2.51 },
    ]);
  });

  it('lifts the breakdown total onto a product line printed with no price', () => {
    const receipt = base([
      { rawText: 'JUMBO SPAGHETTI EI', quantity: 1, lineTotal: 0 },
      { rawText: '2 X 1,39', quantity: 2, lineTotal: 2.78, unitPrice: 1.39 },
    ]);

    const collapsed = collapseContinuationLines(receipt);

    expect(collapsed.lines).toEqual([
      { rawText: 'JUMBO SPAGHETTI EI', quantity: 2, lineTotal: 2.78, unitPrice: 1.39 },
    ]);
  });

  it('matches "N ST x price" breakdowns too', () => {
    const receipt = base([
      { rawText: 'BROOD', quantity: 1, lineTotal: 0 },
      { rawText: '3 ST x 0,99', quantity: 3, lineTotal: 2.97, unitPrice: 0.99 },
    ]);
    expect(collapseContinuationLines(receipt).lines).toHaveLength(1);
    expect(collapseContinuationLines(receipt).lines[0].quantity).toBe(3);
  });

  it('never matches a product name that merely contains an x', () => {
    const receipt = base([
      { rawText: 'WIT PUNTJE X 6', quantity: 1, lineTotal: 1.59 },
      { rawText: 'COCA COLA ZERO 12X33', quantity: 1, lineTotal: 9.39 },
    ]);
    expect(collapseContinuationLines(receipt)).toBe(receipt);
  });

  it('does not fold into a discount line or guess on a conflicting total', () => {
    const discountAbove = base([
      { rawText: 'ACTIE KORTING', quantity: 1, lineTotal: -2.5 },
      { rawText: '2 X 1,25', quantity: 2, lineTotal: 2.5, unitPrice: 1.25 },
    ]);
    // product total 4.00 conflicts with breakdown 2.50 — ambiguous, leave both untouched.
    const conflicting = base([
      { rawText: 'KAAS', quantity: 1, lineTotal: 4.0 },
      { rawText: '2 X 1,25', quantity: 2, lineTotal: 2.5, unitPrice: 1.25 },
    ]);
    expect(collapseContinuationLines(discountAbove).lines).toHaveLength(2);
    expect(collapseContinuationLines(conflicting).lines).toHaveLength(2);
  });

  it('returns the same reference when no continuation lines are present', () => {
    const receipt = base([{ rawText: 'MELK', quantity: 1, lineTotal: 1.29 }]);
    expect(collapseContinuationLines(receipt)).toBe(receipt);
  });
});
