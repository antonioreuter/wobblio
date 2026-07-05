import { describe, it, expect, vi } from 'vitest';
import { EscalatingReceiptParser } from '@core/services/ingestion/EscalatingReceiptParser';
import type { IReceiptParser } from '@core/ports/ingestion/IReceiptParser';
import type { BedrockImage } from '@core/ports/ai/IBedrockConverse';
import type { ParsedReceipt, UnreadableVerdict } from '@core/domain/ingestion';

const image: BedrockImage = { format: 'jpeg', bytes: new Uint8Array([1, 2, 3]) };
const ctx = { countryCode: 'NL', processedDate: '2026-07-04' };

const receipt = (over: Partial<ParsedReceipt> = {}): ParsedReceipt => ({
  merchantRaw: 'Jumbo', transactionDate: '2026-07-04', currency: 'EUR', total: 1.25,
  parseConfidence: 0.97, lines: [{ rawText: 'ICE TEA', quantity: 1, lineTotal: 1.25 }], ...over,
});

const parserReturning = (value: ParsedReceipt | UnreadableVerdict): IReceiptParser => ({
  parse: vi.fn().mockResolvedValue(value),
});

describe('EscalatingReceiptParser', () => {
  it('returns the primary result and never calls the fallback when no escalation is needed', async () => {
    const primary = parserReturning(receipt());
    const fallback = parserReturning(receipt({ merchantRaw: 'FROM_FALLBACK' }));
    const sut = new EscalatingReceiptParser(primary, fallback);

    const result = await sut.parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('Jumbo');
    expect(fallback.parse).not.toHaveBeenCalled();
  });

  it('re-parses with the fallback (same attachment + ctx) and returns its result on escalation', async () => {
    // Primary parse arithmetically inconsistent → escalate.
    const primary = parserReturning(receipt({ total: 99.0 }));
    const fallback = parserReturning(receipt({ merchantRaw: 'FROM_FALLBACK', total: 1.25 }));
    const sut = new EscalatingReceiptParser(primary, fallback);

    const result = await sut.parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('FROM_FALLBACK');
    expect(fallback.parse).toHaveBeenCalledWith(image, ctx);
  });

  it('degrades to the primary result when the fallback model throws (outage/throttle)', async () => {
    const primary = parserReturning(receipt({ total: 99.0 })); // triggers escalation
    const fallback: IReceiptParser = { parse: vi.fn().mockRejectedValue(new Error('ThrottlingException')) };
    const sut = new EscalatingReceiptParser(primary, fallback);

    const result = await sut.parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('Jumbo');
    expect(fallback.parse).toHaveBeenCalledTimes(1);
  });

  it('keeps the primary result when the fallback returns unreadable but the primary was readable', async () => {
    const primary = parserReturning(receipt({ total: 99.0 })); // triggers escalation
    const fallback = parserReturning({ unreadable: true, reason: 'BLURRY' });
    const sut = new EscalatingReceiptParser(primary, fallback);

    const result = await sut.parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('Jumbo');
  });

  it('reports escalation outcomes to the sink (used-fallback, errored, and no-escalation)', async () => {
    const sink = vi.fn();

    // No escalation → sink not called.
    await new EscalatingReceiptParser(parserReturning(receipt()), parserReturning(receipt()), undefined, sink).parse(image, ctx);
    expect(sink).not.toHaveBeenCalled();

    // Escalate (arithmetic) + fallback ok → used the fallback.
    await new EscalatingReceiptParser(parserReturning(receipt({ total: 99.0 })), parserReturning(receipt()), undefined, sink).parse(image, ctx);
    expect(sink).toHaveBeenLastCalledWith({ reason: 'ARITHMETIC', usedFallback: true, fallbackErrored: false });

    // Escalate + fallback throws → degraded, flagged as errored.
    const throwing: IReceiptParser = { parse: vi.fn().mockRejectedValue(new Error('throttle')) };
    await new EscalatingReceiptParser(parserReturning(receipt({ total: 99.0 })), throwing, undefined, sink).parse(image, ctx);
    expect(sink).toHaveBeenLastCalledWith({ reason: 'ARITHMETIC', usedFallback: false, fallbackErrored: true });
  });

  it('never lets a throwing sink affect the parse outcome', async () => {
    const primary = parserReturning(receipt({ total: 99.0 }));
    const fallback = parserReturning(receipt({ merchantRaw: 'FROM_FALLBACK', total: 1.25 }));
    const sut = new EscalatingReceiptParser(primary, fallback, undefined, () => { throw new Error('sink boom'); });

    const result = await sut.parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('FROM_FALLBACK');
  });

  it('uses an injected decision function when provided', async () => {
    const primary = parserReturning(receipt());
    const fallback = parserReturning(receipt({ merchantRaw: 'FROM_FALLBACK' }));
    const sut = new EscalatingReceiptParser(primary, fallback, () => ({ escalate: true }));

    const result = await sut.parse(image, ctx);

    expect((result as ParsedReceipt).merchantRaw).toBe('FROM_FALLBACK');
  });
});
