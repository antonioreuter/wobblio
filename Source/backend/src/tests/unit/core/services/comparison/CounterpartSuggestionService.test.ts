import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { CounterpartSuggestionService } from '@core/services/comparison/CounterpartSuggestionService';
import type {
  CounterpartCandidateRow,
  ICounterpartCandidateQuery,
} from '@core/ports/comparison/ICounterpartCandidateQuery';
import { InvalidTrendQueryError } from '@core/domain/errors';

const ANCHOR = 'aaaaaaaa-0000-4000-8000-000000000001';

const row = (over: Partial<CounterpartCandidateRow> & { productId: string }): CounterpartCandidateRow => ({
  displayName: 'Halfvolle melk',
  brand: null,
  merchantId: 'm-jumbo',
  merchantName: 'Jumbo',
  packSizeBaseUnits: 1,
  baseUnit: 'L',
  embeddingSimilarity: 0.9,
  nameSimilarity: 0.8,
  linked: false,
  ...over,
});

describe('CounterpartSuggestionService', () => {
  let query: MockedObject<ICounterpartCandidateQuery>;
  let sut: CounterpartSuggestionService;

  beforeEach(() => {
    query = { candidates: vi.fn().mockResolvedValue([]) };
    sut = new CounterpartSuggestionService(query);
  });

  it('maps ranked candidates to suggestions with a descriptive size chip', async () => {
    query.candidates.mockResolvedValue([row({ productId: 'p-jumbo', packSizeBaseUnits: 2, baseUnit: 'L' })]);
    const out = await sut.suggest(ANCHOR, 'NL', 'NL-NB');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ productId: 'p-jumbo', merchantName: 'Jumbo', linked: false });
    expect(out[0].size.sizeText).toBe('2L');
  });

  it('surfaces a linked candidate flagged as linked', async () => {
    query.candidates.mockResolvedValue([row({ productId: 'p-linked', embeddingSimilarity: 0.1, linked: true })]);
    const out = await sut.suggest(ANCHOR, 'NL', 'NL-NB');
    expect(out[0].linked).toBe(true);
  });

  it('passes the trend window and picker scope to the query', async () => {
    await sut.suggest(ANCHOR, 'NL', 'NL-NB');
    expect(query.candidates).toHaveBeenCalledWith(
      expect.objectContaining({ productId: ANCHOR, countryCode: 'NL', regionCode: 'NL-NB', weeks: 26 }),
    );
  });

  it('rejects a non-UUID anchor product id', async () => {
    await expect(sut.suggest('not-a-uuid', 'NL', 'NL-NB')).rejects.toBeInstanceOf(InvalidTrendQueryError);
    expect(query.candidates).not.toHaveBeenCalled();
  });

  it('rejects a missing country or region', async () => {
    await expect(sut.suggest(ANCHOR, '', 'NL-NB')).rejects.toBeInstanceOf(InvalidTrendQueryError);
    await expect(sut.suggest(ANCHOR, 'NL', '')).rejects.toBeInstanceOf(InvalidTrendQueryError);
  });
});
