import type { MigrationBuilder } from 'node-pg-migrate';

// Fast-food / restaurant merchant priors (fixes/08). The NL counterpart to the supermarket
// seeds in 20260620120000 — dominant quick-service, fast-food and café chains in the launch
// market plus globally ubiquitous brands, all with a cat-dining-out prior. This is the merchant
// half of the dining-out fix: it anchors §6.4 invoice classification to Dining Out and feeds the
// §6.3 per-line venue hint, so a McDonald's receipt's food/drink lines land in the new dining
// leaves (20260710120000) instead of grocery leaves. It also lets the dining-out / takeaway
// venue tags (which exact-match merchant.brand_name) fire.
//
// Like the other seed_merchants snapshots this is a self-contained, immutable copy mirroring
// src/local/seeds/merchant-aliases.ts; migrations must not import mutable app code, so
// MERCHANT_SEEDS and normalizeAlias are re-declared here. seed_merchants.test.ts pins this
// snapshot to the local seed AND the backend's normalizeMerchantName. Inserts are idempotent.

export interface MerchantSeedRow {
  id: string;
  brand_name: string;
  country_code: string;
  default_category_id: string;
  website: string | null;
  aliases: string[];
}

export const MERCHANT_SEEDS: MerchantSeedRow[] = [
  { id: '01900000-0003-7000-8000-000000000001', brand_name: "McDonald's", country_code: 'NL', default_category_id: 'cat-dining-out', website: 'https://www.mcdonalds.nl', aliases: ['MCDONALDS', 'MC DONALDS', "MCDONALD'S"] },
  { id: '01900000-0003-7000-8000-000000000002', brand_name: 'Burger King', country_code: 'NL', default_category_id: 'cat-dining-out', website: 'https://www.burgerking.nl', aliases: ['BURGER KING', 'BURGERKING'] },
  { id: '01900000-0003-7000-8000-000000000003', brand_name: 'KFC', country_code: 'NL', default_category_id: 'cat-dining-out', website: 'https://www.kfc.nl', aliases: ['KFC', 'KENTUCKY FRIED CHICKEN'] },
  { id: '01900000-0003-7000-8000-000000000004', brand_name: 'Subway', country_code: 'NL', default_category_id: 'cat-dining-out', website: 'https://www.subway.com', aliases: ['SUBWAY'] },
  { id: '01900000-0003-7000-8000-000000000005', brand_name: "Domino's Pizza", country_code: 'NL', default_category_id: 'cat-dining-out', website: 'https://www.dominos.nl', aliases: ['DOMINOS', "DOMINO'S", 'DOMINOS PIZZA'] },
  { id: '01900000-0003-7000-8000-000000000006', brand_name: 'New York Pizza', country_code: 'NL', default_category_id: 'cat-dining-out', website: 'https://www.newyorkpizza.nl', aliases: ['NEW YORK PIZZA'] },
  { id: '01900000-0003-7000-8000-000000000007', brand_name: 'FEBO', country_code: 'NL', default_category_id: 'cat-dining-out', website: 'https://www.febo.nl', aliases: ['FEBO'] },
  { id: '01900000-0003-7000-8000-000000000008', brand_name: 'Starbucks', country_code: 'NL', default_category_id: 'cat-dining-out', website: 'https://www.starbucks.nl', aliases: ['STARBUCKS'] },
  { id: '01900000-0003-7000-8000-000000000009', brand_name: 'La Place', country_code: 'NL', default_category_id: 'cat-dining-out', website: 'https://www.laplace.nl', aliases: ['LA PLACE'] },
  { id: '01900000-0003-7000-8000-000000000010', brand_name: 'Kwalitaria', country_code: 'NL', default_category_id: 'cat-dining-out', website: 'https://www.kwalitaria.nl', aliases: ['KWALITARIA'] },
  { id: '01900000-0003-7000-8000-000000000011', brand_name: 'Pizza Hut', country_code: 'NL', default_category_id: 'cat-dining-out', website: 'https://www.pizzahut.nl', aliases: ['PIZZA HUT', 'PIZZAHUT'] },
  { id: '01900000-0003-7000-8000-000000000012', brand_name: 'Smullers', country_code: 'NL', default_category_id: 'cat-dining-out', website: 'https://www.smullers.nl', aliases: ['SMULLERS'] },
];

// Frozen copy of the backend's normalizeMerchantName (§6.2), pinned to the runtime
// implementation by seed_merchants.test.ts.
const LEGAL_SUFFIXES = new Set([
  'BV', 'NV', 'GMBH', 'LTD', 'INC', 'LLC', 'SA', 'PLC', 'LDA', 'SL', 'SARL',
  'SPA', 'SRL', 'AG', 'OY', 'AB', 'AS', 'LTDA', 'EIRELI',
]);

export function normalizeAlias(raw: string): string {
  const folded = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const depunctuated = folded.replace(/[.,]/g, '').replace(/[^A-Z0-9]+/g, ' ');
  const tokens = depunctuated
    .split(/\s+/)
    .filter((token) => token.length > 0 && !LEGAL_SUFFIXES.has(token));
  return tokens.join(' ').trim();
}

const sqlLiteral = (value: string | null): string =>
  value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Step 1 — heal already-ingested chains by NORMALIZED ALIAS, not by exact brand_name. A chain
  // like McDonald's is often already an AUTO merchant whose brand_name came from the merchant-
  // fallback LLM ("McDonalds", a different apostrophe glyph, different case…), so matching on the
  // literal seed brand_name would miss it. Matching on alias_normalized (how ingestion actually
  // resolves the merchant) sets the dining prior on the row receipts really hit. We set the prior
  // where it differs (idempotent; heals a NULL or a wrong grocery prior) but never touch status or
  // identity — so a rejected/INACTIVE or pre-quorum merchant is not resurrected or merged here.
  const priors = MERCHANT_SEEDS
    .flatMap((m) => m.aliases.map((alias) =>
      `(${sqlLiteral(normalizeAlias(alias))}, ${sqlLiteral(m.country_code)}, ${sqlLiteral(m.default_category_id)})`))
    .join(',\n    ');
  pgm.sql(`
    UPDATE merchant m
    SET default_category_id = s.default_category_id
    FROM merchant_alias a
    JOIN (VALUES
    ${priors}
    ) AS s(alias_normalized, country_code, default_category_id)
      ON a.alias_normalized = s.alias_normalized AND a.country_code = s.country_code
    WHERE m.id = a.merchant_id AND m.default_category_id IS DISTINCT FROM s.default_category_id;
  `);

  // Step 2 — insert canonical seed rows for fresh environments. DO NOTHING on the (brand_name,
  // country_code) conflict: an existing row (AUTO or otherwise) is left exactly as it is — its
  // prior was already healed in step 1, and we must not overwrite its identity/status.
  const merchants = MERCHANT_SEEDS
    .map((m) => `(${sqlLiteral(m.id)}, ${sqlLiteral(m.brand_name)}, ${sqlLiteral(m.country_code)}, ${sqlLiteral(m.default_category_id)}, ${sqlLiteral(m.website)}, 'SEED', 'ACTIVE')`)
    .join(',\n    ');
  pgm.sql(`
    INSERT INTO merchant (id, brand_name, country_code, default_category_id, website, created_via, status) VALUES
    ${merchants}
    ON CONFLICT (brand_name, country_code) DO NOTHING;
  `);

  // Step 3 — attach aliases to whichever row owns each brand (the seed row on a fresh DB, or a
  // pre-existing exact-brand row), resolved by JOIN so the FK never dangles. Idempotent on the
  // (alias_normalized, country_code) unique index — an alias already owned by an AUTO row is left.
  const aliasRows = MERCHANT_SEEDS
    .flatMap((m) => m.aliases.map((alias) =>
      `(${sqlLiteral(m.brand_name)}, ${sqlLiteral(m.country_code)}, ${sqlLiteral(alias)}, ${sqlLiteral(normalizeAlias(alias))})`))
    .join(',\n    ');
  pgm.sql(`
    INSERT INTO merchant_alias (merchant_id, alias_raw, alias_normalized, country_code, source)
    SELECT m.id, s.alias_raw, s.alias_normalized, s.country_code, 'SEED'
    FROM (VALUES
    ${aliasRows}
    ) AS s(brand_name, country_code, alias_raw, alias_normalized)
    JOIN merchant m ON m.brand_name = s.brand_name AND m.country_code = s.country_code
    ON CONFLICT (alias_normalized, country_code) DO NOTHING;
  `);
}

// No-op: seeded merchants/aliases are harmless to retain and may already back existing
// invoices via merchant_id. up() is idempotent so re-applying is safe.
export async function down(): Promise<void> {}
