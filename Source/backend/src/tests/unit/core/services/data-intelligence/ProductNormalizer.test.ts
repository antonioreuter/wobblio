import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ProductNormalizer } from '@core/services/data-intelligence/ProductNormalizer';
import type { IProductCatalog, ProductMatch } from '@core/ports/data-intelligence/IProductCatalog';
import type { IBedrockEmbedder } from '@core/ports/data-intelligence/IBedrockEmbedder';
import type { IBedrockConverse } from '@core/ports/ai/IBedrockConverse';
import type { ParsedLine } from '@core/domain/ingestion';

const converseResult = (content: string) => ({ content, inputTokens: 1, outputTokens: 1, modelId: 'm', durationMs: 1 });

const expansion = (items: unknown[], suggestedTags: string[] = []) =>
  converseResult(JSON.stringify({ items, suggested_tags: suggestedTags }));

const item = (overrides: Record<string, unknown> = {}) => ({
  display_name: 'Milk 1L',
  category_id: 'cat-dairy',
  base_unit: 'L',
  pack_size_base_units: 1,
  is_deposit_or_fee: false,
  ...overrides,
});

const productMatch = (overrides: Partial<ProductMatch> = {}): ProductMatch => ({
  productId: 'p-match',
  categoryId: 'cat-dairy',
  baseUnit: 'L',
  packSizeBaseUnits: 1,
  similarity: 0.95,
  ...overrides,
});

const line = (rawText: string, quantity = 1, lineTotal = 2): ParsedLine => ({ rawText, quantity, lineTotal });

const COUNTRY = 'NL';

describe('ProductNormalizer', () => {
  let catalog: MockedObject<IProductCatalog>;
  let embedder: MockedObject<IBedrockEmbedder>;
  let converse: ReturnType<typeof vi.fn>;
  let sut: ProductNormalizer;

  beforeEach(() => {
    catalog = {
      findExactAlias: vi.fn().mockResolvedValue(null),
      searchByEmbedding: vi.fn().mockResolvedValue([]),
      createProvisionalProduct: vi.fn().mockResolvedValue('p-new'),
      writeAlias: vi.fn(),
    };
    embedder = { embed: vi.fn().mockResolvedValue([0.1, 0.2]) };
    converse = vi.fn();
    sut = new ProductNormalizer(catalog, embedder, { converse } as unknown as IBedrockConverse, 'model');
  });

  it('uses an exact alias hit without any LLM or embedding call', async () => {
    catalog.findExactAlias.mockResolvedValue(productMatch({ productId: 'p1', similarity: 1 }));

    const result = await sut.normalize('m1', [line('MELK', 1, 2)], COUNTRY);

    expect(result.lines[0]).toMatchObject({ productId: 'p1', categoryId: 'cat-dairy', baseUnit: 'L', packQuantity: 1, normalizedUnitPrice: 2, productProvisional: false });
    expect(result.suggestedTags).toEqual([]);
    expect(converse).not.toHaveBeenCalled();
    expect(embedder.embed).not.toHaveBeenCalled();
    // Catalog matching is country-scoped — the country is threaded into the lookup.
    expect(catalog.findExactAlias).toHaveBeenCalledWith('m1', 'MELK', COUNTRY);
  });

  it('accepts a high-confidence embedding match and writes an alias', async () => {
    converse.mockResolvedValue(expansion([item()], ['groceries']));
    catalog.searchByEmbedding.mockResolvedValue([productMatch({ productId: 'p2', similarity: 0.95 })]);

    const result = await sut.normalize('m1', [line('Milk')], COUNTRY);

    expect(result.lines[0]).toMatchObject({ productId: 'p2', productProvisional: false, lowConfidence: false });
    expect(result.suggestedTags).toEqual(['groceries']);
    expect(catalog.writeAlias).toHaveBeenCalledWith(expect.objectContaining({ productId: 'p2', source: 'AUTO_LLM' }));
    // Embedding search is country-scoped too (3rd positional arg).
    expect(catalog.searchByEmbedding).toHaveBeenCalledWith(expect.anything(), expect.anything(), COUNTRY, 1);
  });

  it('flags the low-confidence band (0.85–0.92)', async () => {
    converse.mockResolvedValue(expansion([item()]));
    catalog.searchByEmbedding.mockResolvedValue([productMatch({ similarity: 0.88 })]);

    const result = await sut.normalize('m1', [line('Milk')], COUNTRY);

    expect(result.lines[0].lowConfidence).toBe(true);
    expect(result.lines[0].productProvisional).toBe(false);
  });

  it('creates a provisional product, threading the clean brand + display_name', async () => {
    // The LLM returns a promo-free identity; the normalizer persists brand alongside it.
    converse.mockResolvedValue(expansion([item({ display_name: 'Lucovitaal', brand: 'Lucovitaal', category_id: 'cat-vitamins', base_unit: 'PIECE' })]));
    catalog.searchByEmbedding.mockResolvedValue([]);

    const result = await sut.normalize('m1', [line('Discount 1+1 Lucovitaal')], COUNTRY);

    expect(result.lines[0]).toMatchObject({ productId: 'p-new', productProvisional: true, lowConfidence: false });
    expect(catalog.createProvisionalProduct).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Lucovitaal', brand: 'Lucovitaal', countryCode: COUNTRY }));
  });

  it('creates a provisional product when the best match is below the floor', async () => {
    converse.mockResolvedValue(expansion([item()]));
    catalog.searchByEmbedding.mockResolvedValue([productMatch({ similarity: 0.5 })]);

    const result = await sut.normalize('m1', [line('Mystery item')], COUNTRY);

    expect(result.lines[0].productProvisional).toBe(true);
  });

  it('treats deposit/fee lines as non-products with no embedding', async () => {
    converse.mockResolvedValue(expansion([item({ display_name: 'Statiegeld', category_id: 'cat-other', is_deposit_or_fee: true })]));

    const result = await sut.normalize('m1', [line('Statiegeld', 1, 0.25)], COUNTRY);

    expect(result.lines[0]).toMatchObject({ productId: null, isDepositOrFee: true, baseUnit: null, packQuantity: null, normalizedUnitPrice: null });
    expect(embedder.embed).not.toHaveBeenCalled();
  });

  it('mixes exact-alias and expanded lines and only expands the unmatched ones', async () => {
    catalog.findExactAlias.mockImplementation(async (_m, normalized) =>
      normalized === 'MELK' ? productMatch({ productId: 'p-exact', similarity: 1 }) : null,
    );
    converse.mockResolvedValue(expansion([item({ display_name: 'Bread', category_id: 'cat-bakery', base_unit: 'PIECE' })]));
    catalog.searchByEmbedding.mockResolvedValue([productMatch({ productId: 'p-bread', categoryId: 'cat-bakery', baseUnit: 'PIECE', similarity: 0.93 })]);

    const result = await sut.normalize('m1', [line('MELK'), line('Brood')], COUNTRY);

    expect(result.lines[0].productId).toBe('p-exact');
    expect(result.lines[1].productId).toBe('p-bread');
    expect(converse).toHaveBeenCalledTimes(1);
  });

  it('chunks expansion for large receipts so output never truncates (one call per ≤20-line batch)', async () => {
    const many = Array.from({ length: 21 }, (_, i) => line(`Item ${i}`));
    converse
      .mockResolvedValueOnce(expansion(Array.from({ length: 20 }, () => item())))
      .mockResolvedValueOnce(expansion([item()]));

    const result = await sut.normalize('m1', many, COUNTRY);

    expect(converse).toHaveBeenCalledTimes(2);
    expect(result.lines).toHaveLength(21);
  });

  it('prefers the printed unit size over the LLM/catalog pack size', async () => {
    converse.mockResolvedValue(expansion([item({ pack_size_base_units: 1 })])); // LLM says 1 L
    const withSize: ParsedLine = { rawText: 'Melk 500ML', quantity: 1, lineTotal: 2, unitSizeRaw: '500ML' };

    const result = await sut.normalize('m1', [withSize], COUNTRY);

    // 500ML parses to 0.5 L → normalized unit price 2 / 1 / 0.5 = 4 (not 2 from the LLM's 1 L).
    expect(result.lines[0].packQuantity).toBe(0.5);
    expect(result.lines[0].normalizedUnitPrice).toBe(4);
  });

  it('ignores a printed size whose unit conflicts with the canonical base unit', async () => {
    converse.mockResolvedValue(expansion([item({ base_unit: 'L', pack_size_base_units: 1 })]));
    const mismatched: ParsedLine = { rawText: 'X', quantity: 1, lineTotal: 2, unitSizeRaw: '3ST' }; // PIECE, not L

    const result = await sut.normalize('m1', [mismatched], COUNTRY);

    expect(result.lines[0].packQuantity).toBe(1); // falls back to the LLM/catalog pack size
  });
});
