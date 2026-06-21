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
      const alias = `SHOP ${randomUUID().slice(0, 8)}`.toUpperCase();
      const merchantId = await catalog.createProvisionalMerchant('Test Shop', 'NL', 'cat-hardware');
      await catalog.writeAlias({ merchantId, aliasRaw: alias, aliasNormalized: alias, countryCode: 'NL', source: 'AUTO_LLM' });
      const found = await catalog.findExactAlias(alias, 'NL');
      expect(found?.merchantId).toBe(merchantId);
      expect(await catalog.getDefaultCategory(merchantId)).toBe('cat-hardware');
    });
  });

  describe('ProductCatalogAdapter (pgvector)', () => {
    it('creates a provisional product and matches it by embedding + category filter', async () => {
      const catalog = new ProductCatalogAdapter(pool);
      const embedding = uniqueEmbedding();
      const productId = await catalog.createProvisionalProduct({
        displayName: `Test Milk ${randomUUID().slice(0, 8)}`,
        categoryId: 'cat-dairy',
        baseUnit: 'L',
        packSizeBaseUnits: 1,
        embedding,
      });

      const matches = await catalog.searchByEmbedding(embedding, 'cat-dairy', 5);
      const self = matches.find(m => m.productId === productId);
      expect(self).toBeDefined();
      expect(self!.similarity).toBeGreaterThan(0.99);
      expect(self!.categoryId).toBe('cat-dairy');

      const filteredOut = await catalog.searchByEmbedding(embedding, 'cat-transport', 5);
      expect(filteredOut.some(m => m.productId === productId)).toBe(false);
    });

    it('writes back a merchant-scoped alias and finds it exactly', async () => {
      const catalog = new ProductCatalogAdapter(pool);
      const productId = await catalog.createProvisionalProduct({ displayName: 'Test Bread', categoryId: 'cat-bakery', baseUnit: 'PIECE', packSizeBaseUnits: null, embedding: uniqueEmbedding() });
      const alias = `BREAD ${randomUUID().slice(0, 8)}`.toUpperCase();
      await catalog.writeAlias({ productId, aliasNormalized: alias, merchantId: null, source: 'AUTO_LLM' });
      const found = await catalog.findExactAlias(null, alias);
      expect(found?.productId).toBe(productId);
      expect(found?.baseUnit).toBe('PIECE');
    });
  });

  describe('PriceObservationStoreAdapter (de-identified)', () => {
    it('inserts a row carrying no tenant/user/invoice reference', async () => {
      const merchant = await new MerchantCatalogAdapter(pool).findExactAlias('ALBERT HEIJN', 'NL');
      const productId = await new ProductCatalogAdapter(pool).createProvisionalProduct({ displayName: 'Obs Milk', categoryId: 'cat-dairy', baseUnit: 'L', packSizeBaseUnits: 1, embedding: uniqueEmbedding() });

      await new PriceObservationStoreAdapter(pool).emit([
        {
          productId, merchantId: merchant!.merchantId, countryCode: 'NL', regionCode: 'NL-NB',
          observedOn: '2026-06-10', packPrice: 1.29, normalizedUnitPrice: 1.29, baseUnit: 'L',
          currency: 'EUR', wasDiscounted: false, quarantined: true, contributorTrustAtWrite: 50,
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
