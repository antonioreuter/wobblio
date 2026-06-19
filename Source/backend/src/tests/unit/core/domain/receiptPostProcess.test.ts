import { describe, it, expect } from 'vitest';
import { dropNonItemLines } from '@core/domain/receiptPostProcess';
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
