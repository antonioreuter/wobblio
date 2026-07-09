import { describe, it, expect } from 'vitest';
import { MERCHANT_SEEDS as NL_MERCHANT_SEEDS } from '../src/migrations/20260620120000_seed_merchants';
import { MERCHANT_SEEDS as BR_MERCHANT_SEEDS, normalizeAlias } from '../src/migrations/20260709120000_seed_br_merchants';
import { merchantSeeds, normalizeMerchantAlias } from '../src/local/seeds/merchant-aliases';
import { CATEGORY_TAXONOMY } from '../../backend/src/core/domain/categoryTaxonomy';
import { normalizeMerchantName } from '../../backend/src/core/domain/merchantNormalize';

// Merchant seed data lives in three independently-edited places that the migration runner
// and the hexagonal boundary prevent from sharing imports:
//   1. the seed_merchants migration snapshots — what populates deployed DBs (one per country;
//      NL in 20260620120000, BR in 20260709120000). normalizeAlias is imported from the latest
//      snapshot, whose frozen suffix set tracks the backend's.
//   2. src/local/seeds/merchant-aliases.ts   — what seed:local writes to local DBs (all countries)
//   3. backend normalizeMerchantName          — how ingestion normalizes names before lookup
// These tests make any divergence a build failure, so a prior added in one place without
// the others can never reach prod as a missing category prior or a dead (never-matched) alias.
const MERCHANT_SEEDS = [...NL_MERCHANT_SEEDS, ...BR_MERCHANT_SEEDS];

const serialize = (m: { id: string; brand_name: string; country_code: string; default_category_id: string; website: string | null; aliases: string[] }) =>
  `${m.id}|${m.brand_name}|${m.country_code}|${m.default_category_id}|${m.website ?? ''}|${[...m.aliases].sort().join(',')}`;

describe('merchant snapshot vs local seed', () => {
  it('is identical (id, brand, country, default_category, website, aliases)', () => {
    const fromMigration = MERCHANT_SEEDS.map(serialize).sort();
    const fromSeed = merchantSeeds.map(serialize).sort();
    expect(fromMigration).toEqual(fromSeed);
  });
});

describe('alias normalization parity across all three copies', () => {
  const allAliases = MERCHANT_SEEDS.flatMap((m) => m.aliases);

  it('migration, local seed, and backend normalize identically', () => {
    for (const alias of allAliases) {
      const backend = normalizeMerchantName(alias);
      expect(normalizeAlias(alias)).toBe(backend);
      expect(normalizeMerchantAlias(alias)).toBe(backend);
    }
  });

  it('no (alias_normalized, country_code) resolves to two different merchants', () => {
    // Intra-merchant collisions are fine (legal-suffix variants collapse and dedupe via
    // ON CONFLICT). A cross-merchant collision would make the prior ambiguous — reject it.
    const owners = new Map<string, string>();
    for (const m of MERCHANT_SEEDS) {
      for (const alias of m.aliases) {
        const key = `${normalizeAlias(alias)}|${m.country_code}`;
        const existing = owners.get(key);
        expect(existing === undefined || existing === m.id, `${key} -> ${existing} & ${m.id}`).toBe(true);
        owners.set(key, m.id);
      }
    }
  });
});

describe('seeded priors reference real categories', () => {
  it('every default_category_id exists in CATEGORY_TAXONOMY', () => {
    const ids = new Set(CATEGORY_TAXONOMY.map((c) => c.id));
    const unknown = MERCHANT_SEEDS.map((m) => m.default_category_id).filter((id) => !ids.has(id));
    expect(unknown).toEqual([]);
  });
});
