import { describe, it, expect } from 'vitest';
import { computeSplitSummary, type SplitLine, type SplitAssignment } from '@core/domain/billSplit';

const product = (id: string, lineTotal: number, quantity = 1): SplitLine => ({
  id, label: id, quantity, lineTotal, isDiscount: false, isDepositOrFee: false,
});
const deposit = (id: string, lineTotal: number): SplitLine => ({
  id, label: id, quantity: 1, lineTotal, isDiscount: false, isDepositOrFee: true,
});
const discount = (id: string, lineTotal: number): SplitLine => ({
  id, label: id, quantity: 1, lineTotal, isDiscount: true, isDepositOrFee: false,
});
const find = (s: ReturnType<typeof computeSplitSummary>, name: string) =>
  s.participants.find((p) => p.name === name);

describe('computeSplitSummary', () => {
  it('splits fully-assigned lines with proportional fees, no owner remainder', () => {
    const lines = [product('L1', 10), product('L2', 6)];
    const assignments: SplitAssignment[] = [
      { lineId: 'L1', participantName: 'Alice', fraction: 1 },
      { lineId: 'L2', participantName: 'Bob', fraction: 1 },
    ];
    const s = computeSplitSummary(lines, assignments, 20); // feePool 4

    expect(find(s, 'You')).toBeUndefined();
    expect(find(s, 'Alice')).toMatchObject({ subtotal: 10, fees: 2.5, total: 12.5 });
    expect(find(s, 'Bob')).toMatchObject({ subtotal: 6, fees: 1.5, total: 7.5 });
    expect(s.grandTotal).toBe(20);
  });

  it('gives the unassigned remainder of a fractional line to the owner', () => {
    const lines = [product('L1', 10, 2)];
    const s = computeSplitSummary(lines, [{ lineId: 'L1', participantName: 'Alice', fraction: 0.5 }], 10);

    expect(find(s, 'Alice')).toMatchObject({ subtotal: 5, total: 5 });
    expect(find(s, 'You')).toMatchObject({ subtotal: 5, total: 5 });
    expect(find(s, 'Alice')?.items[0]).toMatchObject({ qty: 1, fraction: 0.5, amount: 5 });
    expect(find(s, 'You')?.items[0]).toMatchObject({ qty: 1, fraction: 0.5, amount: 5 });
  });

  it('handles a three-way split with no fees', () => {
    const lines = [product('L1', 9), product('L2', 6), product('L3', 3)];
    const s = computeSplitSummary(
      lines,
      [
        { lineId: 'L1', participantName: 'A', fraction: 1 },
        { lineId: 'L2', participantName: 'B', fraction: 1 },
        { lineId: 'L3', participantName: 'C', fraction: 1 },
      ],
      18,
    );
    expect(s.participants).toHaveLength(3);
    expect(find(s, 'A')).toMatchObject({ subtotal: 9, fees: 0, total: 9 });
  });

  it('excludes deposit lines from the assignable subtotal and folds them into the fee pool', () => {
    const lines = [product('L1', 10), deposit('D1', 0.25)];
    const s = computeSplitSummary(lines, [{ lineId: 'L1', participantName: 'Alice', fraction: 1 }], 10.25);

    expect(find(s, 'You')).toBeUndefined();
    expect(find(s, 'Alice')).toMatchObject({ subtotal: 10, fees: 0.25, total: 10.25 });
  });

  it('spreads a negative fee pool (net discount) across shares', () => {
    const lines = [product('L1', 10), discount('X1', -2)];
    const s = computeSplitSummary(lines, [{ lineId: 'L1', participantName: 'Alice', fraction: 1 }], 8);
    expect(find(s, 'Alice')).toMatchObject({ subtotal: 10, fees: -2, total: 8 });
  });

  it('returns no participants when the assignable subtotal is zero', () => {
    const s = computeSplitSummary([deposit('D1', 5)], [], 5);
    expect(s.participants).toHaveLength(0);
    expect(s.grandTotal).toBe(5);
  });

  it('ignores an assignment whose lineId matches no product line, and gives a wholly-unassigned line entirely to the owner', () => {
    const lines = [product('L1', 10), product('L2', 5)];
    const assignments: SplitAssignment[] = [
      { lineId: 'L1', participantName: 'Alice', fraction: 1 },
      { lineId: 'BOGUS', participantName: 'Ghost', fraction: 1 }, // no matching product line
      // L2 has no assignment at all — owner must absorb it via the "no entry" (?? 0) default,
      // not the partial-fraction path already covered by other tests.
    ];
    const s = computeSplitSummary(lines, assignments, 15); // no fees

    expect(find(s, 'Ghost')).toBeUndefined();
    expect(find(s, 'Alice')).toMatchObject({ subtotal: 10, fees: 0, total: 10 });
    expect(find(s, 'You')).toMatchObject({ subtotal: 5, fees: 0, total: 5 });
  });

  it('reconciles onto a later (not first) participant when it is the largest', () => {
    const lines = [product('L1', 7), product('L2', 11), product('L3', 13)];
    const s = computeSplitSummary(
      lines,
      [
        { lineId: 'L1', participantName: 'A', fraction: 1 },
        { lineId: 'L2', participantName: 'B', fraction: 1 },
        { lineId: 'L3', participantName: 'C', fraction: 1 },
      ],
      31.01, // feePool 0.01 rounds to 0.00 for every share; the 0.01 residual lands on C (largest)
    );

    expect(find(s, 'A')).toMatchObject({ total: 7 });
    expect(find(s, 'B')).toMatchObject({ total: 11 });
    expect(find(s, 'C')).toMatchObject({ subtotal: 13, fees: 0.01, total: 13.01 });
  });

  it('reconciles a rounding residual onto the largest share so parts sum to the printed total', () => {
    const lines = [product('L1', 10), product('L2', 10), product('L3', 10)];
    const s = computeSplitSummary(
      lines,
      [
        { lineId: 'L1', participantName: 'A', fraction: 1 },
        { lineId: 'L2', participantName: 'B', fraction: 1 },
        { lineId: 'L3', participantName: 'C', fraction: 1 },
      ],
      30.01, // feePool 0.01 → 0.0033 each rounds to 0.00; residual lands on the largest
    );
    const sum = s.participants.reduce((acc, p) => acc + p.total, 0);
    expect(Number(sum.toFixed(2))).toBe(30.01);
  });
});
