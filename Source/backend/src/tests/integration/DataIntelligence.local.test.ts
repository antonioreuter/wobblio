import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { MerchantCatalogAdapter } from '@infrastructure/adapters/data-intelligence/MerchantCatalogAdapter';
import { ProductCatalogAdapter } from '@infrastructure/adapters/data-intelligence/ProductCatalogAdapter';
import { PriceObservationStoreAdapter } from '@infrastructure/adapters/data-intelligence/PriceObservationStoreAdapter';
import { RegionReferenceAdapter } from '@infrastructure/adapters/data-intelligence/RegionReferenceAdapter';

// A unique random vector per call. Cosine of an identical vector is 1, so a freshly
// created product is its own nearest neighbour even as earlier test runs accumulate.
const uniqueEmbedding = (): number[] => Array.from({ length: 512 }, () => Math.random());

describe('Data-intelligence adapters — Postgres', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ host: 'localhost', port: 5432, database: 'wobblio_local', user: 'wobblio_dev', password: 'wobblio_dev_secret', max: 4 });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('MerchantCatalogAdapter (pg_trgm)', () => {
    it('finds a seeded merchant by exact alias and reads its default category', async () => {
      const catalog = new MerchantCatalogAdapter(pool);
      const match = await catalog.findExactAlias('ALBERT HEIJN', 'NL');
      expect(match?.brandName).toBe('Albert Heijn');
      expect(match?.similarity).toBe(1);
      const category = await catalog.getDefaultCategory(match!.merchantId);
      expect(category).toBe('cat-groceries');
    });

    it('finds a seeded merchant by fuzzy similarity', async () => {
      const catalog = new MerchantCatalogAdapter(pool);
      const matches = await catalog.findFuzzyAliases('ALBRT HEIJN', 'NL', 5);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].similarity).toBeGreaterThan(0);
      expect(matches[0].similarity).toBeLessThan(1);
      expect(matches.some(m => m.brandName === 'Albert Heijn')).toBe(true);
    });

    it('creates a provisional merchant and writes back a retrievable alias', async () => {
      const catalog = new MerchantCatalogAdapter(pool);
      const suffix = randomUUID().slice(0, 8);
      const alias = `SHOP ${suffix}`.toUpperCase();
      // Unique brand per run: the (brand_name, country_code) uniqueness constraint makes a
      // fixed name return a stale row on re-run instead of inserting the passed category.
      const merchantId = await catalog.createProvisionalMerchant(`Test Shop ${suffix}`, 'NL', 'cat-hardware');
      await catalog.writeAlias({ merchantId, aliasRaw: alias, aliasNormalized: alias, countryCode: 'NL', source: 'AUTO_LLM' });
      const found = await catalog.findExactAlias(alias, 'NL');
      expect(found?.merchantId).toBe(merchantId);
      expect(await catalog.getDefaultCategory(merchantId)).toBe('cat-hardware');
    });

    it('surfaces the seeded brand as a candidate for an over-captured header', async () => {
      const catalog = new MerchantCatalogAdapter(pool);
      const blob = 'ALBERT HEIJN XL EINDHOVEN WINKELCENTRUM WOENSEL';
      // The alias search misses the blob entirely; the brand candidate is the safety net.
      expect(await catalog.findExactAlias(blob, 'NL')).toBeNull();
      const candidates = await catalog.findBrandCandidates(blob, 'NL', 5);
      expect(candidates.some(c => c.brandName === 'Albert Heijn')).toBe(true);
    });

    it('reuses the existing merchant instead of creating a brand-name duplicate', async () => {
      const catalog = new MerchantCatalogAdapter(pool);
      const brand = `Dedup Co ${randomUUID().slice(0, 8)}`;
      const first = await catalog.createProvisionalMerchant(brand, 'NL', 'cat-hardware');
      const second = await catalog.createProvisionalMerchant(brand, 'NL', 'cat-groceries');
      expect(second).toBe(first);
      const count = await pool.query('SELECT count(*)::int AS n FROM merchant WHERE brand_name = $1 AND country_code = $2', [brand, 'NL']);
      expect(count.rows[0].n).toBe(1);
    });
  });

  describe('ProductCatalogAdapter (pgvector)', () => {
    it('creates a provisional product and matches it by embedding + category filter', async () => {
      const catalog = new ProductCatalogAdapter(pool);
      const embedding = uniqueEmbedding();
      const productId = await catalog.createProvisionalProduct({
        displayName: `Test Milk ${randomUUID().slice(0, 8)}`,
        brand: null,
        categoryId: 'cat-dairy',
        countryCode: 'NL',
        merchantId: null,
        baseUnit: 'L',
        packSizeBaseUnits: 1,
        embedding,
      });

      // Candidate search is merchant-scoped (09/02); null here matches the null-merchant product.
      const matches = await catalog.searchByEmbedding(null, embedding, 'cat-dairy', 'NL', 5);
      const self = matches.find(m => m.productId === productId);
      expect(self).toBeDefined();
      expect(self!.similarity).toBeGreaterThan(0.99);
      expect(self!.categoryId).toBe('cat-dairy');

      const filteredOut = await catalog.searchByEmbedding(null, embedding, 'cat-transport', 'NL', 5);
      expect(filteredOut.some(m => m.productId === productId)).toBe(false);
    });

    it('writes back a merchant-scoped alias and finds it exactly', async () => {
      const catalog = new ProductCatalogAdapter(pool);
      const productId = await catalog.createProvisionalProduct({ displayName: 'Test Bread', brand: null, categoryId: 'cat-bakery', countryCode: 'NL', merchantId: null, baseUnit: 'PIECE', packSizeBaseUnits: null, embedding: uniqueEmbedding() });
      const alias = `BREAD ${randomUUID().slice(0, 8)}`.toUpperCase();
      await catalog.writeAlias({ productId, aliasNormalized: alias, merchantId: null, source: 'AUTO_LLM' });
      const found = await catalog.findExactAlias(null, alias, 'NL');
      expect(found?.productId).toBe(productId);
      expect(found?.baseUnit).toBe('PIECE');
    });

    it('persists brand and drops the dead concept / alias-counter columns', async () => {
      const catalog = new ProductCatalogAdapter(pool);
      const name = `Branded Item ${randomUUID().slice(0, 8)}`;
      const productId = await catalog.createProvisionalProduct({ displayName: name, brand: 'Lucovitaal', categoryId: 'cat-vitamins', countryCode: 'NL', merchantId: null, baseUnit: 'PIECE', packSizeBaseUnits: null, embedding: uniqueEmbedding() });
      await catalog.writeAlias({ productId, aliasNormalized: name.toUpperCase(), merchantId: null, source: 'AUTO_LLM' });

      const stored = await pool.query('SELECT brand FROM product WHERE id = $1', [productId]);
      expect(stored.rows[0].brand).toBe('Lucovitaal');

      const dropped = await pool.query<{ table_name: string; column_name: string }>(
        `SELECT table_name, column_name FROM information_schema.columns
         WHERE (table_name = 'product' AND column_name = 'concept_id')
            OR (table_name = 'product_alias' AND column_name IN ('match_count', 'last_seen_at'))`,
      );
      expect(dropped.rowCount).toBe(0);
      expect(await pool.query("SELECT to_regclass('public.product_concept') AS t").then(r => r.rows[0].t)).toBeNull();
    });
  });

  describe('PriceObservationStoreAdapter (de-identified)', () => {
    it('inserts a row carrying no tenant/user/invoice reference', async () => {
      const merchant = await new MerchantCatalogAdapter(pool).findExactAlias('ALBERT HEIJN', 'NL');
      const productId = await new ProductCatalogAdapter(pool).createProvisionalProduct({ displayName: 'Obs Milk', categoryId: 'cat-dairy', baseUnit: 'L', packSizeBaseUnits: 1, embedding: uniqueEmbedding() });

      await new PriceObservationStoreAdapter(pool).emit([
        {
          productId, merchantId: merchant!.merchantId, countryCode: 'NL', regionCode: 'NL-NB',
          observedOn: '2026-06-10', packPrice: 1.29,
          currency: 'EUR', wasDiscounted: false, quality: 'AUTO', quarantined: true, contributorTrustAtWrite: 50,
        },
      ]);

      const inserted = await pool.query(
        `SELECT region_code, quarantined FROM price_observation WHERE product_id = $1 AND merchant_id = $2`,
        [productId, merchant!.merchantId],
      );
      expect(inserted.rowCount).toBe(1);
      expect(inserted.rows[0].region_code).toBe('NL-NB');
      expect(inserted.rows[0].quarantined).toBe(true);
    });

    it('the price_observation table holds no tenant/user/invoice/household columns (de-identification)', async () => {
      const columns = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'price_observation'`,
      );
      const names = columns.rows.map(r => r.column_name).join(' ');
      expect(names).not.toMatch(/tenant|user|invoice|household/);
    });
  });

  describe('RegionReferenceAdapter (ISO 3166)', () => {
    it('lists seeded countries and subdivisions and validates region membership', async () => {
      const reference = new RegionReferenceAdapter(pool);
      const countries = await reference.listCountries();
      expect(countries.length).toBe(16);

      const nlSubdivisions = await reference.listSubdivisions('NL');
      expect(nlSubdivisions.length).toBe(12);
      expect(nlSubdivisions.some(s => s.code === 'NL-NB')).toBe(true);

      expect(await reference.isValidRegion('NL', 'NL-NB')).toBe(true);
      expect(await reference.isValidRegion('NL', 'US-CA')).toBe(false);
    });
  });
});
