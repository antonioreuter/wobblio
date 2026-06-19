import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { RegionReferenceAdapter } from '@infrastructure/adapters/data-intelligence/RegionReferenceAdapter';

// Exercises resolveReceiptLocation against the seeded ISO 3166 reference tables
// (country / country_subdivision), including the pg_trgm name match.
describe('RegionReferenceAdapter.resolveReceiptLocation — Postgres end-to-end', () => {
  let pool: Pool;
  let adapter: RegionReferenceAdapter;

  beforeAll(() => {
    pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'wobblio_local',
      user: 'wobblio_dev',
      password: 'wobblio_dev_secret',
      max: 2,
    });
    adapter = new RegionReferenceAdapter(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('resolves a printed country + region name to ISO codes (pg_trgm)', async () => {
    const resolved = await adapter.resolveReceiptLocation({ countryCode: 'FR', regionText: 'Bretagne' });
    expect(resolved).toEqual({ countryCode: 'FR', regionCode: 'FR-BRE' });
  });

  it('resolves an exact ISO 3166-2 region code', async () => {
    const resolved = await adapter.resolveReceiptLocation({ countryCode: 'NL', regionText: 'NL-NB' });
    expect(resolved).toEqual({ countryCode: 'NL', regionCode: 'NL-NB' });
  });

  it('keeps the country but nulls the region when the region name is unknown', async () => {
    const resolved = await adapter.resolveReceiptLocation({ countryCode: 'FR', regionText: 'Nowhere-shire' });
    expect(resolved).toEqual({ countryCode: 'FR', regionCode: null });
  });

  it('returns nulls for an unknown country', async () => {
    const resolved = await adapter.resolveReceiptLocation({ countryCode: 'ZZ', regionText: 'Bretagne' });
    expect(resolved).toEqual({ countryCode: null, regionCode: null });
  });

  it('returns a null region when no region text is given', async () => {
    const resolved = await adapter.resolveReceiptLocation({ countryCode: 'NL' });
    expect(resolved).toEqual({ countryCode: 'NL', regionCode: null });
  });
});
