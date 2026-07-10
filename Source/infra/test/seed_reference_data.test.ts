import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  COUNTRIES,
  SUBDIVISIONS,
} from '../src/migrations/20260616100000_seed_reference_data';
import {
  UK_COUNTRIES,
  UK_SUBDIVISIONS,
} from '../src/migrations/20260617115000_uk_nations_resplit';
import {
  ADDED_CATEGORIES,
  RENAMED_CATEGORIES,
  REMOVED_CATEGORIES,
} from '../src/migrations/20260619120000_expand_grocery_categories';
import { DEPOSIT_CATEGORIES } from '../src/migrations/20260619130000_line_order_deposits_emission_block';
import { VENUE_CATEGORIES } from '../src/migrations/20260710120000_add_dining_out_and_bar_leaves';
import { categorySeed } from '../src/local/seeds/product-taxonomy';
import { countrySeed, subdivisionSeed } from '../src/local/seeds/country-subdivisions';
import { CATEGORY_TAXONOMY } from '../../backend/src/core/domain/categoryTaxonomy';

// Effective product_category state after all migrations: the base snapshot with the
// follow-up expansion migration's renames applied and its new leaves appended. The seed
// and backend taxonomy must match this post-migration state, not the frozen base.
const RENAME_BY_ID = new Map(RENAMED_CATEGORIES.map((r) => [r.id, r]));
const REMOVED = new Set(REMOVED_CATEGORIES);
const EFFECTIVE_CATEGORIES = [
  ...CATEGORIES.filter((c) => !REMOVED.has(c.id)).map((c) => {
    const renamed = RENAME_BY_ID.get(c.id);
    return renamed ? { ...c, name: renamed.name, nameNl: renamed.nameNl } : c;
  }),
  ...ADDED_CATEGORIES,
  ...DEPOSIT_CATEGORIES,
  ...VENUE_CATEGORIES,
];

// Reference data lives in three independently-edited places that the migration runner and
// the hexagonal boundary prevent from sharing imports:
//   1. this migration snapshot  — what populates deployed DBs (FK target rows)
//   2. src/local/seeds/*        — what `seed:local` writes to local DBs
//   3. backend categoryTaxonomy — what the ingestion worker is allowed to emit
// These tests make any divergence a build failure, so a category/region added in one place
// without the others can never reach prod as a product_category FK violation or a
// local/deployed data drift.

describe('product_category snapshot vs local seed', () => {
  it('is identical (id, parent, name, name_nl, level)', () => {
    const fromMigration = EFFECTIVE_CATEGORIES
      .map((c) => `${c.id}|${c.parentId ?? ''}|${c.name}|${c.nameNl}|${c.level}`)
      .sort();
    const fromSeed = categorySeed
      .map((c) => `${c.id}|${c.parent_id ?? ''}|${c.name}|${c.name_nl}|${c.level}`)
      .sort();
    expect(fromMigration).toEqual(fromSeed);
  });
});

describe('country / country_subdivision snapshot vs local seed', () => {
  it('countries are identical (code, name)', () => {
    const fromMigration = COUNTRIES.map((c) => `${c.code}|${c.name}`).sort();
    const fromSeed = countrySeed.map((c) => `${c.code}|${c.name}`).sort();
    expect(fromMigration).toEqual(fromSeed);
  });

  it('subdivisions are identical (code, country_code, name)', () => {
    const fromMigration = SUBDIVISIONS.map((s) => `${s.code}|${s.countryCode}|${s.name}`).sort();
    const fromSeed = subdivisionSeed.map((s) => `${s.code}|${s.country_code}|${s.name}`).sort();
    expect(fromMigration).toEqual(fromSeed);
  });
});

describe('uk_nations_resplit migration vs seed snapshot', () => {
  // The resplit migration re-inlines the four UK nations + their regions (it must
  // be self-contained), so it is the one UK data copy the country/subdivision
  // parity above does not reach. Pin it to the snapshot's UK subset here, so a
  // future UK correction in the snapshot that forgets the resplit copy fails the
  // build instead of leaving already-seeded stages with stale reference data.
  const UK_CODES = new Set(['EN', 'SC', 'WA', 'NI']);

  it('countries match the snapshot UK subset (code, name)', () => {
    const fromResplit = UK_COUNTRIES.map((c) => `${c.code}|${c.name}`).sort();
    const fromSnapshot = COUNTRIES
      .filter((c) => UK_CODES.has(c.code))
      .map((c) => `${c.code}|${c.name}`)
      .sort();
    expect(fromResplit).toEqual(fromSnapshot);
  });

  it('subdivisions match the snapshot UK subset (code, country_code, name)', () => {
    const fromResplit = UK_SUBDIVISIONS.map((s) => `${s.code}|${s.countryCode}|${s.name}`).sort();
    const fromSnapshot = SUBDIVISIONS
      .filter((s) => UK_CODES.has(s.countryCode))
      .map((s) => `${s.code}|${s.countryCode}|${s.name}`)
      .sort();
    expect(fromResplit).toEqual(fromSnapshot);
  });
});

describe('backend category validator is covered by the seeded snapshot', () => {
  it('every CATEGORY_TAXONOMY id exists in the migration snapshot', () => {
    const seededIds = new Set(EFFECTIVE_CATEGORIES.map((c) => c.id));
    const uncovered = CATEGORY_TAXONOMY.map((c) => c.id).filter((id) => !seededIds.has(id));
    expect(uncovered).toEqual([]);
  });
});
