import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VisionParseService } from '@core/services/ingestion/VisionParseService';
import type { BedrockDocument, BedrockImage, IBedrockConverse } from '@core/ports/ai/IBedrockConverse';
import { SchemaValidationError } from '@core/domain/errors';

const VALID_JSON = JSON.stringify({
  merchant_raw: 'Albert Heijn',
  transaction_date: '2026-06-10',
  currency: 'EUR',
  total: 1.29,
  parse_confidence: 0.9,
  lines: [{ raw_text: 'Melk', quantity: 1, line_total: 1.29 }],
});

const converseResult = (content: string) => ({
  content,
  inputTokens: 10,
  outputTokens: 20,
  modelId: 'mock-model',
  durationMs: 5,
});

const image: BedrockImage = { format: 'jpeg', bytes: new Uint8Array([1, 2, 3]) };
const ctx = { countryCode: 'NL', processedDate: '2026-06-18' };

describe('VisionParseService', () => {
  let converse: ReturnType<typeof vi.fn>;
  let sut: VisionParseService;

  beforeEach(() => {
    converse = vi.fn();
    sut = new VisionParseService({ converse } as unknown as IBedrockConverse, 'mock-model', 'PROMPT', 'vision-parse/v1');
  });

  it('returns the parsed receipt on a valid first response', async () => {
    converse.mockResolvedValue(converseResult(VALID_JSON));

    const receipt = await sut.parse(image, ctx);

    expect(receipt.merchantRaw).toBe('Albert Heijn');
    expect(converse).toHaveBeenCalledTimes(1);
    const sent = converse.mock.calls[0][0].messages as Array<{ content: string; image?: unknown }>;
    expect(sent[0].content).toContain('<user_country>NL</user_country>');
    expect(sent[0].content).toContain('<processed_date>2026-06-18</processed_date>');
    expect(sent[0].image).toEqual(image);
  });

  it('forwards a PDF as a document attachment', async () => {
    converse.mockResolvedValue(converseResult(VALID_JSON));
    const document: BedrockDocument = { format: 'pdf', bytes: new Uint8Array([4, 5, 6]), name: 'receipt' };

    await sut.parse(document, ctx);

    const sent = converse.mock.calls[0][0].messages as Array<{ document?: unknown; image?: unknown }>;
    expect(sent[0].document).toEqual(document);
    expect(sent[0].image).toBeUndefined();
  });

  it('strips summary/loyalty rows the model emitted despite the prompt', async () => {
    const withPhantoms = JSON.stringify({
      merchant_raw: 'Albert Heijn',
      transaction_date: '2026-06-10',
      currency: 'EUR',
      total: 9.39,
      parse_confidence: 0.9,
      lines: [
        { raw_text: 'BONUSKAART xx5482', quantity: 1, line_total: 0 },
        { raw_text: 'COCA-COLA', quantity: 1, line_total: 9.39 },
        { raw_text: 'TOTAAL', quantity: 1, line_total: 9.39 },
      ],
    });
    converse.mockResolvedValue(converseResult(withPhantoms));

    const receipt = await sut.parse(image, ctx);

    expect(receipt.lines.map(l => l.rawText)).toEqual(['COCA-COLA']);
  });

  it('retries once with validation errors appended, then succeeds', async () => {
    converse
      .mockResolvedValueOnce(converseResult('not json'))
      .mockResolvedValueOnce(converseResult(VALID_JSON));

    const receipt = await sut.parse(image, ctx);

    expect(receipt.total).toBe(1.29);
    expect(converse).toHaveBeenCalledTimes(2);
    const retryMessages = converse.mock.calls[1][0].messages as Array<{ content: string }>;
    expect(retryMessages.some(m => m.content.includes('validation_errors'))).toBe(true);
  });

  it('throws SchemaValidationError when both attempts fail validation', async () => {
    converse.mockResolvedValue(converseResult('still not json'));

    await expect(sut.parse(image, ctx)).rejects.toBeInstanceOf(SchemaValidationError);
    expect(converse).toHaveBeenCalledTimes(2);
  });
});
