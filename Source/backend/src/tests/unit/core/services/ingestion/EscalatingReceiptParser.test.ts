import { describe, it, expect, vi } from 'vitest';
import { EscalatingReceiptParser, type EscalationTargets } from '@core/services/ingestion/EscalatingReceiptParser';
import type { IReceiptParser } from '@core/ports/ingestion/IReceiptParser';
import type { BedrockImage } from '@core/ports/ai/IBedrockConverse';
import type { ParsedReceipt, UnreadableVerdict } from '@core/domain/ingestion';
import { DEFAULT_ESCALATION_THRESHOLDS } from '@core/domain/visionEscalation';
import type { ReceiptEscalationDecision } from '@core/domain/receiptEscalation';

const image: BedrockImage = { format: 'jpeg', bytes: new Uint8Array([1, 2, 3]) };
const ctx = { countryCode: 'NL', processedDate: '2026-07-04' };
const T = DEFAULT_ESCALATION_THRESHOLDS;

const receipt = (over: Partial<ParsedReceipt> = {}): ParsedReceipt => ({
  merchantRaw: 'Jumbo', transactionDate: '2026-07-04', currency: 'EUR', total: 1.25,
  parseConfidence: 0.97, lines: [{ rawText: 'ICE TEA', quantity: 1, lineTotal: 1.25 }], ...over,
});

const parserReturning = (value: ParsedReceipt | UnreadableVerdict): IReceiptParser => ({
  parse: vi.fn().mockResolvedValue(value),
});

// A decider that always asks for a given tier — lets target-routing tests pick the tier directly.
const always = (tier: ReceiptEscalationDecision['tier'], reason?: ReceiptEscalationDecision['reason']) =>
  (): ReceiptEscalationDecision => ({ tier, reason });

describe('EscalatingReceiptParser', () => {
  it('returns the primary result and never escalates a clean parse', async () => {
    const primary = parserReturning(receipt());
    const deep = parserReturning(receipt({ merchantRaw: 'FROM_DEEP' }));
    const result = await new EscalatingReceiptParser(primary, { FALLBACK_DEEP: deep }, T).parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('Jumbo');
    expect(deep.parse).not.toHaveBeenCalled();
  });

  it('escalates an arithmetically-broken parse to the DEEP tier and returns its result', async () => {
    // Σ lines 1.25 vs total 99 → reconciliation 0 → blended 0 → FALLBACK_DEEP (real decider).
    const primary = parserReturning(receipt({ total: 99.0 }));
    const deep = parserReturning(receipt({ merchantRaw: 'FROM_DEEP', total: 1.25 }));
    const sink = vi.fn();
    const result = await new EscalatingReceiptParser(primary, { FALLBACK_DEEP: deep }, T, sink).parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('FROM_DEEP');
    expect(deep.parse).toHaveBeenCalledWith(image, ctx);
    expect(sink).toHaveBeenLastCalledWith(
      expect.objectContaining({ tier: 'FALLBACK_DEEP', ranTier: 'FALLBACK_DEEP', reason: 'ARITHMETIC', usedFallback: true, fallbackErrored: false }),
    );
  });

  it('degrades a DEEP decision to the mid tier when only the mid tier is provisioned', async () => {
    const primary = parserReturning(receipt({ total: 99.0 }));
    const mid = parserReturning(receipt({ merchantRaw: 'FROM_MID', total: 1.25 }));
    const sink = vi.fn();
    const result = await new EscalatingReceiptParser(primary, { FALLBACK: mid }, T, sink).parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('FROM_MID');
    expect(sink).toHaveBeenLastCalledWith(expect.objectContaining({ tier: 'FALLBACK_DEEP', ranTier: 'FALLBACK' }));
  });

  it('upgrades a MID decision to the deep tier when only the deep tier is provisioned', async () => {
    const primary = parserReturning(receipt({ total: 99.0 }));
    const deep = parserReturning(receipt({ merchantRaw: 'FROM_DEEP', total: 1.25 }));
    const sink = vi.fn();
    const sut = new EscalatingReceiptParser(primary, { FALLBACK_DEEP: deep }, T, sink, always('FALLBACK', 'LOW_CONFIDENCE'));

    const result = await sut.parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('FROM_DEEP');
    expect(sink).toHaveBeenLastCalledWith(expect.objectContaining({ tier: 'FALLBACK', ranTier: 'FALLBACK_DEEP' }));
  });

  it('behaves as the primary alone when no tier is provisioned', async () => {
    const primary = parserReturning(receipt({ total: 99.0 }));
    const sink = vi.fn();
    const result = await new EscalatingReceiptParser(primary, {}, T, sink).parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('Jumbo');
    expect(sink).not.toHaveBeenCalled();
  });

  it('degrades to the primary result when the fallback model throws (outage/throttle)', async () => {
    const primary = parserReturning(receipt({ total: 99.0 }));
    const deep: IReceiptParser = { parse: vi.fn().mockRejectedValue(new Error('ThrottlingException')) };
    const sink = vi.fn();
    const result = await new EscalatingReceiptParser(primary, { FALLBACK_DEEP: deep }, T, sink).parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('Jumbo');
    expect(sink).toHaveBeenLastCalledWith(expect.objectContaining({ usedFallback: false, fallbackErrored: true }));
  });

  it('keeps the primary result when the fallback returns unreadable but the primary was readable', async () => {
    const primary = parserReturning(receipt({ total: 99.0 }));
    const deep = parserReturning({ unreadable: true, reason: 'BLURRY' });
    const result = await new EscalatingReceiptParser(primary, { FALLBACK_DEEP: deep }, T).parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('Jumbo');
  });

  it('routes a mid-band decision to the mid tier (injected decider)', async () => {
    const primary = parserReturning(receipt());
    const mid = parserReturning(receipt({ merchantRaw: 'FROM_MID' }));
    const deep = parserReturning(receipt({ merchantRaw: 'FROM_DEEP' }));
    const targets: EscalationTargets = { FALLBACK: mid, FALLBACK_DEEP: deep };
    const sut = new EscalatingReceiptParser(primary, targets, T, undefined, always('FALLBACK', 'LOW_CONFIDENCE'));

    const result = await sut.parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('FROM_MID');
    expect(deep.parse).not.toHaveBeenCalled();
  });

  it('never lets a throwing sink affect the parse outcome', async () => {
    const primary = parserReturning(receipt({ total: 99.0 }));
    const deep = parserReturning(receipt({ merchantRaw: 'FROM_DEEP', total: 1.25 }));
    const sut = new EscalatingReceiptParser(primary, { FALLBACK_DEEP: deep }, T, () => { throw new Error('sink boom'); });

    const result = await sut.parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('FROM_DEEP');
  });
});
