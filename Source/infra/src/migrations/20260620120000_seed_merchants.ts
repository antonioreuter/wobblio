import type { MigrationBuilder } from 'node-pg-migrate';

// Well-known merchant priors (§6.2 / §6.4). Auto-created merchants land with no
// default_category_id, so an invoice whose line-item vote has no clear majority falls
// straight through to the LLM tiebreak with nothing to anchor it. Seeding the dominant
// chains gives the classifier a merchant prior (e.g. Gamma -> Hardware & DIY) for the
// common case at zero AI cost.
//
// Like 20260616100000_seed_reference_data, this is a self-contained, immutable snapshot
// mirroring src/local/seeds/merchant-aliases.ts. Migrations must not import mutable app
// code, so MERCHANT_SEEDS and normalizeAlias are re-declared here; seed_merchants.test.ts
// pins this snapshot to the local seed AND to the backend's normalizeMerchantName so the
// three copies can never drift. Inserts are idempotent (ON CONFLICT) and safe to re-run.
//
// One merchant row per (brand, country): a cross-border brand (Lidl, IKEA, ...) is modelled
// as one row per country, each with its own default_category_id and country-scoped aliases.
// Launch scope is NL only; other countries are added in follow-up migrations.

export interface MerchantSeedRow {
  id: string;
  brand_name: string;
  country_code: string;
  default_category_id: string;
  website: string | null;
  aliases: string[];
}

export const MERCHANT_SEEDS: MerchantSeedRow[] = [
  { id: '01900000-0001-7000-8000-000000000001', brand_name: 'Albert Heijn', country_code: 'NL', default_category_id: 'cat-groceries', website: 'https://www.ah.nl', aliases: ['ALBERT HEIJN', 'AH', 'AH TO GO', 'ALBERT HEIJN BV', 'AH ONLINE'] },
  { id: '01900000-0001-7000-8000-000000000002', brand_name: 'Jumbo', country_code: 'NL', default_category_id: 'cat-groceries', website: 'https://www.jumbo.com', aliases: ['JUMBO', 'JUMB', 'JUMBO SUPERMARKTEN', 'JUMBO SUPERMARKT'] },
  { id: '01900000-0001-7000-8000-000000000003', brand_name: 'Lidl', country_code: 'NL', default_category_id: 'cat-groceries', website: 'https://www.lidl.nl', aliases: ['LIDL', 'LIDL NEDERLAND', 'LIDL NEDERLAND BV'] },
  { id: '01900000-0001-7000-8000-000000000004', brand_name: 'Aldi', country_code: 'NL', default_category_id: 'cat-groceries', website: 'https://www.aldi.nl', aliases: ['ALDI', 'ALDI MARKT', 'ALDI NEDERLAND', 'ALDI SUPERMARKT'] },
  { id: '01900000-0001-7000-8000-000000000005', brand_name: 'Plus', country_code: 'NL', default_category_id: 'cat-groceries', website: 'https://www.plus.nl', aliases: ['PLUS', 'PLUS RETAIL', 'PLUS SUPERMARKT'] },
  { id: '01900000-0001-7000-8000-000000000006', brand_name: 'Dirk', country_code: 'NL', default_category_id: 'cat-groceries', website: 'https://www.dirk.nl', aliases: ['DIRK', 'DIRK VAN DEN BROEK', 'DIRK SUPERMARKT'] },
  { id: '01900000-0001-7000-8000-000000000007', brand_name: 'Kruidvat', country_code: 'NL', default_category_id: 'cat-personal-care', website: 'https://www.kruidvat.nl', aliases: ['KRUIDVAT', 'KRUIDVAT RETAIL', 'KRUIDVAT BV'] },
  { id: '01900000-0001-7000-8000-000000000008', brand_name: 'Etos', country_code: 'NL', default_category_id: 'cat-personal-care', website: 'https://www.etos.nl', aliases: ['ETOS', 'ETOS BV', 'ETOS DROGISTERIJ'] },
  { id: '01900000-0001-7000-8000-000000000009', brand_name: 'Trekpleister', country_code: 'NL', default_category_id: 'cat-personal-care', website: 'https://www.trekpleister.nl', aliases: ['TREKPLEISTER', 'TREKPLEISTER BV', 'TREKPLEISTER DROGIST'] },
  { id: '01900000-0001-7000-8000-000000000010', brand_name: 'HEMA', country_code: 'NL', default_category_id: 'cat-household', website: 'https://www.hema.nl', aliases: ['HEMA', 'HEMA BV', 'HEMA NEDERLAND'] },
  { id: '01900000-0001-7000-8000-000000000011', brand_name: 'Action', country_code: 'NL', default_category_id: 'cat-other', website: 'https://www.action.com', aliases: ['ACTION', 'ACTION NEDERLAND', 'ACTION BV'] },
  { id: '01900000-0001-7000-8000-000000000012', brand_name: 'Gamma', country_code: 'NL', default_category_id: 'cat-hardware', website: 'https://www.gamma.nl', aliases: ['GAMMA', 'GAMMA BOUWMARKT'] },
  { id: '01900000-0001-7000-8000-000000000013', brand_name: 'Praxis', country_code: 'NL', default_category_id: 'cat-hardware', website: 'https://www.praxis.nl', aliases: ['PRAXIS', 'PRAXIS BOUWMARKT', 'PRAXIS DOE-HET-ZELF'] },
  { id: '01900000-0001-7000-8000-000000000014', brand_name: 'Karwei', country_code: 'NL', default_category_id: 'cat-hardware', website: 'https://www.karwei.nl', aliases: ['KARWEI', 'KARWEI BOUWMARKT'] },
  { id: '01900000-0001-7000-8000-000000000015', brand_name: 'Hornbach', country_code: 'NL', default_category_id: 'cat-hardware', website: 'https://www.hornbach.nl', aliases: ['HORNBACH', 'HORNBACH BOUWMARKT'] },
  { id: '01900000-0001-7000-8000-000000000016', brand_name: 'MediaMarkt', country_code: 'NL', default_category_id: 'cat-electronics', website: 'https://www.mediamarkt.nl', aliases: ['MEDIAMARKT', 'MEDIA MARKT', 'MEDIA MARKT NEDERLAND'] },
  { id: '01900000-0001-7000-8000-000000000017', brand_name: 'Coolblue', country_code: 'NL', default_category_id: 'cat-electronics', website: 'https://www.coolblue.nl', aliases: ['COOLBLUE'] },
  { id: '01900000-0001-7000-8000-000000000018', brand_name: 'IKEA', country_code: 'NL', default_category_id: 'cat-home-garden', website: 'https://www.ikea.com/nl', aliases: ['IKEA', 'IKEA NEDERLAND'] },
  { id: '01900000-0001-7000-8000-000000000019', brand_name: 'Blokker', country_code: 'NL', default_category_id: 'cat-household', website: 'https://www.blokker.nl', aliases: ['BLOKKER'] },
  { id: '01900000-0001-7000-8000-000000000020', brand_name: 'Zeeman', country_code: 'NL', default_category_id: 'cat-clothing', website: 'https://www.zeeman.com', aliases: ['ZEEMAN', 'ZEEMAN TEXTIEL'] },
  { id: '01900000-0001-7000-8000-000000000021', brand_name: 'Shell', country_code: 'NL', default_category_id: 'cat-transport', website: 'https://www.shell.nl', aliases: ['SHELL', 'SHELL NEDERLAND'] },
  { id: '01900000-0001-7000-8000-000000000022', brand_name: 'BP', country_code: 'NL', default_category_id: 'cat-transport', website: 'https://www.bp.com', aliases: ['BP', 'BP NEDERLAND'] },
];

// Frozen copy of the backend's normalizeMerchantName (§6.2). Pinned to the runtime
// implementation by seed_merchants.test.ts.
const LEGAL_SUFFIXES = new Set([
  'BV', 'NV', 'GMBH', 'LTD', 'INC', 'LLC', 'SA', 'PLC', 'LDA', 'SL', 'SARL',
  'SPA', 'SRL', 'AG', 'OY', 'AB', 'AS',
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
  const merchants = MERCHANT_SEEDS
    .map((m) => `(${sqlLiteral(m.id)}, ${sqlLiteral(m.brand_name)}, ${sqlLiteral(m.country_code)}, ${sqlLiteral(m.default_category_id)}, ${sqlLiteral(m.website)}, 'SEED', 'ACTIVE')`)
    .join(',\n    ');
  pgm.sql(`
    INSERT INTO merchant (id, brand_name, country_code, default_category_id, website, created_via, status) VALUES
    ${merchants}
    ON CONFLICT (id) DO UPDATE SET
      brand_name = EXCLUDED.brand_name,
      default_category_id = EXCLUDED.default_category_id,
      website = EXCLUDED.website,
      created_via = 'SEED',
      status = 'ACTIVE';
  `);

  const aliases = MERCHANT_SEEDS
    .flatMap((m) => m.aliases.map((alias) =>
      `(${sqlLiteral(m.id)}, ${sqlLiteral(alias)}, ${sqlLiteral(normalizeAlias(alias))}, ${sqlLiteral(m.country_code)}, 'SEED')`))
    .join(',\n    ');
  pgm.sql(`
    INSERT INTO merchant_alias (merchant_id, alias_raw, alias_normalized, country_code, source) VALUES
    ${aliases}
    ON CONFLICT (alias_normalized, country_code) DO NOTHING;
  `);

  // Heal pre-existing AUTO merchants: an alias collision above leaves an earlier
  // auto-created merchant (e.g. an already-ingested Gamma) owning the alias, so the seed's
  // category prior never reaches it. Backfill the prior onto those rows where it is still
  // missing, without merging merchant identities (existing invoices keep their merchant_id).
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
    WHERE m.id = a.merchant_id AND m.default_category_id IS NULL;
  `);
}

// No-op: seeded merchants/aliases are harmless to retain and may already back existing
// invoices via merchant_id; a DELETE would strand rollbacks of later migrations. up() is
// idempotent so re-applying is safe.
export async function down(): Promise<void> {}
