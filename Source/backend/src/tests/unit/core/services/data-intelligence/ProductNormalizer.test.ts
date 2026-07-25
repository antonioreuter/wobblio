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
    embedder = { embed: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2], inputTokens: 4 }) };
    converse = vi.fn();
    sut = new ProductNormalizer(catalog, embedder, { converse } as unknown as IBedrockConverse, 'model');
  });

  it('uses an exact alias hit without any LLM or embedding call', async () => {
    catalog.findExactAlias.mockResolvedValue(productMatch({ productId: 'p1', similarity: 1 }));

    const result = await sut.normalize('m1', [line('MELK', 1, 2)], COUNTRY);

    expect(result.lines[0]).toMatchObject({ productId: 'p1', categoryId: 'cat-dairy', baseUnit: 'L', packQuantity: 1, sizeSource: null, productProvisional: false });
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
    // Per-merchant identity (09/02): candidate search is scoped to the receipt's merchant (1st arg)
    // and country (4th arg), so a ≥0.92 match at another merchant is never even a candidate.
    expect(catalog.searchByEmbedding).toHaveBeenCalledWith('m1', expect.anything(), expect.anything(), COUNTRY, 1);
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
    // Per-merchant identity (09/02): a new product is stamped with the receipt's merchant.
    expect(catalog.createProvisionalProduct).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Lucovitaal', brand: 'Lucovitaal', countryCode: COUNTRY, merchantId: 'm1' }));
  });

  it('creates a provisional product when the best match is below the floor', async () => {
    converse.mockResolvedValue(expansion([item()]));
    catalog.searchByEmbedding.mockResolvedValue([productMatch({ similarity: 0.5 })]);

    const result = await sut.normalize('m1', [line('Mystery item')], COUNTRY);

    expect(result.lines[0].productProvisional).toBe(true);
  });

  it('yields a distinct product per merchant for the same line text (09/02 per-merchant identity)', async () => {
    // Each merchant's candidate search is scoped to that merchant, so an identical name at a new
    // merchant finds no candidate and creates its own product stamped with that merchant.
    converse.mockResolvedValue(expansion([item({ display_name: 'Halfvolle melk' })]));
    catalog.searchByEmbedding.mockResolvedValue([]);

    await sut.normalize('ah', [line('Halfvolle melk')], COUNTRY);
    await sut.normalize('jumbo', [line('Halfvolle melk')], COUNTRY);

    expect(catalog.searchByEmbedding).toHaveBeenNthCalledWith(1, 'ah', expect.anything(), expect.anything(), COUNTRY, 1);
    expect(catalog.searchByEmbedding).toHaveBeenNthCalledWith(2, 'jumbo', expect.anything(), expect.anything(), COUNTRY, 1);
    expect(catalog.createProvisionalProduct).toHaveBeenNthCalledWith(1, expect.objectContaining({ merchantId: 'ah' }));
    expect(catalog.createProvisionalProduct).toHaveBeenNthCalledWith(2, expect.objectContaining({ merchantId: 'jumbo' }));
  });

  it('treats deposit/fee lines as non-products with no embedding', async () => {
    converse.mockResolvedValue(expansion([item({ display_name: 'Statiegeld', category_id: 'cat-other', is_deposit_or_fee: true })]));

    const result = await sut.normalize('m1', [line('Statiegeld', 1, 0.25)], COUNTRY);

    expect(result.lines[0]).toMatchObject({ productId: null, isDepositOrFee: true, baseUnit: null, packQuantity: null, sizeSource: null });
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

  it('prefers the printed unit size over the LLM/catalog pack size and tags it RECEIPT', async () => {
    converse.mockResolvedValue(expansion([item({ pack_size_base_units: 1 })])); // LLM says 1 L
    const withSize: ParsedLine = { rawText: 'Melk 500ML', quantity: 1, lineTotal: 2, unitSizeRaw: '500ML' };

    const result = await sut.normalize('m1', [withSize], COUNTRY);

    // 500ML parses to 0.5 L → descriptive pack size 0.5, evidence RECEIPT (fix 09/01: no price math).
    expect(result.lines[0].packQuantity).toBe(0.5);
    expect(result.lines[0].sizeSource).toBe('RECEIPT');
  });

  it('threads a <merchant> venue hint into the expansion prompt when a merchant context is given (fixes/08)', async () => {
    converse.mockResolvedValue(expansion([item({ display_name: 'Big Mac', category_id: 'cat-dining-meals', base_unit: 'PIECE' })]));
    catalog.searchByEmbedding.mockResolvedValue([]);

    await sut.normalize('m-mcd', [line('BIG MAC')], COUNTRY, { brandName: "McDonald's", categoryPrior: 'cat-dining-out' });

    const content = converse.mock.calls[0][0].messages[0].content as string;
    expect(content).toContain(`<merchant brand="McDonald's" typical_category="cat-dining-out"/>`);
  });

  it('rolls a sub-category prior up to its macro in the venue hint', async () => {
    converse.mockResolvedValue(expansion([item()]));
    catalog.searchByEmbedding.mockResolvedValue([]);

    await sut.normalize('m1', [line('X')], COUNTRY, { brandName: null, categoryPrior: 'cat-dining-meals' });

    const content = converse.mock.calls[0][0].messages[0].content as string;
    expect(content).toContain('<merchant typical_category="cat-dining-out"/>');
  });

  it('omits the <merchant> block entirely for an unknown merchant (legacy message shape)', async () => {
    converse.mockResolvedValue(expansion([item()]));
    catalog.searchByEmbedding.mockResolvedValue([]);

    await sut.normalize('m1', [line('Milk')], COUNTRY);

    const content = converse.mock.calls[0][0].messages[0].content as string;
    expect(content).not.toContain('<merchant');
    expect(content.startsWith('<categories>')).toBe(true);
  });

  it('omits the <merchant> block for a non-venue merchant, keeping the legacy shape on the grocery path (fixes/08 #5)', async () => {
    converse.mockResolvedValue(expansion([item()]));
    catalog.searchByEmbedding.mockResolvedValue([]);

    await sut.normalize('m-ah', [line('Melk')], COUNTRY, { brandName: 'Albert Heijn', categoryPrior: 'cat-groceries' });

    const content = converse.mock.calls[0][0].messages[0].content as string;
    expect(content).not.toContain('<merchant');
  });

  it('emits a dining-out venue hint from the RESTAURANT_BILL parse flag for an unseeded eatery with no prior (fixes/08 #1)', async () => {
    converse.mockResolvedValue(expansion([item({ display_name: 'Cheeseburger', category_id: 'cat-dining-meals', base_unit: 'PIECE' })]));
    catalog.searchByEmbedding.mockResolvedValue([]);

    await sut.normalize('m-diner', [line('CHEESEBURGER')], COUNTRY, { brandName: 'Corner Diner', categoryPrior: null, documentKindHint: 'RESTAURANT_BILL' });

    const content = converse.mock.calls[0][0].messages[0].content as string;
    expect(content).toContain(`<merchant brand="Corner Diner" typical_category="cat-dining-out"/>`);
  });

  it('ignores a printed size whose unit conflicts with the canonical base unit', async () => {
    converse.mockResolvedValue(expansion([item({ base_unit: 'L', pack_size_base_units: 1 })]));
    const mismatched: ParsedLine = { rawText: 'X', quantity: 1, lineTotal: 2, unitSizeRaw: '3ST' }; // PIECE, not L

    const result = await sut.normalize('m1', [mismatched], COUNTRY);

    expect(result.lines[0].packQuantity).toBe(1); // falls back to the LLM/catalog pack size
  });

  // ── 07/04 §1–2: concurrency must not disturb positional alignment ────────────────────────────
  describe('concurrent embedding + expansion (fix 07/04)', () => {
    it('keeps each embedding with its own line when they resolve out of order', async () => {
      const names = ['Milk 1L', 'Bread', 'Cheese'];
      converse.mockResolvedValue(expansion(names.map((n) => item({ display_name: n }))));
      // Resolve in reverse order, so arrival order is the opposite of input order.
      embedder.embed.mockImplementation(async (text: string) => {
        const index = names.indexOf(text);
        await new Promise((r) => setTimeout(r, (names.length - index) * 5));
        return { embedding: [index], inputTokens: 4 };
      });
      catalog.searchByEmbedding.mockResolvedValue([]);

      await sut.normalize('m1', names.map((n) => line(n)), COUNTRY);

      // Each provisional product must carry the embedding of ITS OWN display name.
      const created = catalog.createProvisionalProduct.mock.calls.map((c) => c[0]);
      expect(created.map((p) => p.displayName)).toEqual(names);
      expect(created.map((p) => p.embedding)).toEqual([[0], [1], [2]]);
    });

    it('runs embeddings concurrently rather than one after another', async () => {
      const names = ['a', 'b', 'c', 'd'];
      converse.mockResolvedValue(expansion(names.map((n) => item({ display_name: n }))));
      let inFlight = 0;
      let peak = 0;
      embedder.embed.mockImplementation(async () => {
        peak = Math.max(peak, ++inFlight);
        await new Promise((r) => setTimeout(r, 10));
        inFlight--;
        return { embedding: [0.1], inputTokens: 4 };
      });

      await sut.normalize('m1', names.map((n) => line(n)), COUNTRY);

      expect(peak).toBeGreaterThan(1);
    });

    it('never embeds a deposit/fee line, and still aligns the lines around it', async () => {
      converse.mockResolvedValue(expansion([
        item({ display_name: 'Cola' }),
        item({ display_name: 'Statiegeld', is_deposit_or_fee: true, category_id: 'cat-other' }),
        item({ display_name: 'Chips' }),
      ]));
      catalog.searchByEmbedding.mockResolvedValue([]);

      const result = await sut.normalize('m1', [line('COLA'), line('STATIEGELD'), line('CHIPS')], COUNTRY);

      expect(embedder.embed.mock.calls.map((c) => c[0])).toEqual(['Cola', 'Chips']);
      expect(result.lines[1]).toMatchObject({ isDepositOrFee: true, productId: null, categoryId: 'cat-other' });
      expect(result.lines[0].isDepositOrFee).toBe(false);
      expect(result.lines[2].isDepositOrFee).toBe(false);
    });

    it('preserves chunk order when a later expansion chunk resolves before an earlier one', async () => {
      // 25 lines → two chunks (20 + 5). The second chunk answers first.
      const first = Array.from({ length: 20 }, (_, i) => item({ display_name: `first-${i}` }));
      const second = Array.from({ length: 5 }, (_, i) => item({ display_name: `second-${i}` }));
      converse
        .mockImplementationOnce(async () => {
          await new Promise((r) => setTimeout(r, 30));
          return expansion(first, ['tag-a']);
        })
        .mockImplementationOnce(async () => expansion(second, ['tag-b']));
      catalog.searchByEmbedding.mockResolvedValue([]);

      const lines = Array.from({ length: 25 }, (_, i) => line(`RAW-${i}`));
      await sut.normalize('m1', lines, COUNTRY);

      const embedded = embedder.embed.mock.calls.map((c) => c[0]);
      expect(embedded[0]).toBe('first-0');
      expect(embedded[19]).toBe('first-19');
      expect(embedded[20]).toBe('second-0');
      expect(embedded).toHaveLength(25);
    });

    it('unions suggested tags across chunks regardless of which resolves first', async () => {
      converse
        .mockImplementationOnce(async () => {
          await new Promise((r) => setTimeout(r, 20));
          return expansion(Array.from({ length: 20 }, () => item()), ['dairy', 'shared']);
        })
        .mockImplementationOnce(async () => expansion([item()], ['snacks', 'shared']));
      catalog.searchByEmbedding.mockResolvedValue([]);

      const result = await sut.normalize('m1', Array.from({ length: 21 }, (_, i) => line(`R${i}`)), COUNTRY);

      expect([...result.suggestedTags].sort()).toEqual(['dairy', 'shared', 'snacks']);
    });
  });
});
