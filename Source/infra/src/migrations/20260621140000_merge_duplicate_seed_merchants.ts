import type { MigrationBuilder } from 'node-pg-migrate';

// Merge AUTO duplicates into their SEED merchant (§6.2 / §6.8). When a receipt was
// ingested BEFORE 20260620120000_seed_merchants ran, the LLM fallback auto-created a
// merchant and grabbed a normalized alias (e.g. "GAMMA"). The later seed insert then
// hit ON CONFLICT DO NOTHING, so the SEED Gamma never owned that alias and a duplicate
// merchant kept the alias + the invoices. seed_merchants only healed the category prior
// onto the duplicate; it deliberately did not merge identities. This migration finishes
// the job: an AUTO merchant owning a seeded alias is folded into the SEED merchant so a
// brand resolves to a single id (invoices, price observations, aliases consolidate).
//
// Identity key: an AUTO merchant that owns a merchant_alias whose (alias_normalized,
// country_code) is one of the frozen seed aliases mapped to a different, existing SEED
// merchant. All five merchant FKs (price_observation, invoice, merchant_branch,
// product_alias, merchant_alias) are reassigned before the duplicate is deleted. Only
// merchant_alias carries a (alias_normalized, country_code) unique index, so colliding
// duplicate aliases are dropped before the rest are reassigned. Idempotent: re-running
// finds no remaining collisions.
//
// Migrations must not import mutable app code (node-pg-migrate loads each file in
// isolation and cannot resolve sibling imports), so the seed snapshot + normalizeAlias
// are re-declared here, mirroring 20260620120000_seed_merchants.

export interface MergeMerchantSeedRow {
  id: string;
  country_code: string;
  aliases: string[];
}

export const MERCHANT_SEEDS: MergeMerchantSeedRow[] = [
  { id: '01900000-0001-7000-8000-000000000001', country_code: 'NL', aliases: ['ALBERT HEIJN', 'AH', 'AH TO GO', 'ALBERT HEIJN BV', 'AH ONLINE'] },
  { id: '01900000-0001-7000-8000-000000000002', country_code: 'NL', aliases: ['JUMBO', 'JUMB', 'JUMBO SUPERMARKTEN', 'JUMBO SUPERMARKT'] },
  { id: '01900000-0001-7000-8000-000000000003', country_code: 'NL', aliases: ['LIDL', 'LIDL NEDERLAND', 'LIDL NEDERLAND BV'] },
  { id: '01900000-0001-7000-8000-000000000004', country_code: 'NL', aliases: ['ALDI', 'ALDI MARKT', 'ALDI NEDERLAND', 'ALDI SUPERMARKT'] },
  { id: '01900000-0001-7000-8000-000000000005', country_code: 'NL', aliases: ['PLUS', 'PLUS RETAIL', 'PLUS SUPERMARKT'] },
  { id: '01900000-0001-7000-8000-000000000006', country_code: 'NL', aliases: ['DIRK', 'DIRK VAN DEN BROEK', 'DIRK SUPERMARKT'] },
  { id: '01900000-0001-7000-8000-000000000007', country_code: 'NL', aliases: ['KRUIDVAT', 'KRUIDVAT RETAIL', 'KRUIDVAT BV'] },
  { id: '01900000-0001-7000-8000-000000000008', country_code: 'NL', aliases: ['ETOS', 'ETOS BV', 'ETOS DROGISTERIJ'] },
  { id: '01900000-0001-7000-8000-000000000009', country_code: 'NL', aliases: ['TREKPLEISTER', 'TREKPLEISTER BV', 'TREKPLEISTER DROGIST'] },
  { id: '01900000-0001-7000-8000-000000000010', country_code: 'NL', aliases: ['HEMA', 'HEMA BV', 'HEMA NEDERLAND'] },
  { id: '01900000-0001-7000-8000-000000000011', country_code: 'NL', aliases: ['ACTION', 'ACTION NEDERLAND', 'ACTION BV'] },
  { id: '01900000-0001-7000-8000-000000000012', country_code: 'NL', aliases: ['GAMMA', 'GAMMA BOUWMARKT'] },
  { id: '01900000-0001-7000-8000-000000000013', country_code: 'NL', aliases: ['PRAXIS', 'PRAXIS BOUWMARKT', 'PRAXIS DOE-HET-ZELF'] },
  { id: '01900000-0001-7000-8000-000000000014', country_code: 'NL', aliases: ['KARWEI', 'KARWEI BOUWMARKT'] },
  { id: '01900000-0001-7000-8000-000000000015', country_code: 'NL', aliases: ['HORNBACH', 'HORNBACH BOUWMARKT'] },
  { id: '01900000-0001-7000-8000-000000000016', country_code: 'NL', aliases: ['MEDIAMARKT', 'MEDIA MARKT', 'MEDIA MARKT NEDERLAND'] },
  { id: '01900000-0001-7000-8000-000000000017', country_code: 'NL', aliases: ['COOLBLUE'] },
  { id: '01900000-0001-7000-8000-000000000018', country_code: 'NL', aliases: ['IKEA', 'IKEA NEDERLAND'] },
  { id: '01900000-0001-7000-8000-000000000019', country_code: 'NL', aliases: ['BLOKKER'] },
  { id: '01900000-0001-7000-8000-000000000020', country_code: 'NL', aliases: ['ZEEMAN', 'ZEEMAN TEXTIEL'] },
  { id: '01900000-0001-7000-8000-000000000021', country_code: 'NL', aliases: ['SHELL', 'SHELL NEDERLAND'] },
  { id: '01900000-0001-7000-8000-000000000022', country_code: 'NL', aliases: ['BP', 'BP NEDERLAND'] },
];

// Frozen copy of the backend's normalizeMerchantName (§6.2), matching the seed migration.
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

const sqlLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  const seedAliasRows = MERCHANT_SEEDS
    .flatMap((m) => m.aliases.map((alias) =>
      `(${sqlLiteral(normalizeAlias(alias))}, ${sqlLiteral(m.country_code)}, ${sqlLiteral(m.id)}::uuid)`))
    .join(',\n      ');

  pgm.sql(`
    DO $$
    DECLARE
      pair RECORD;
    BEGIN
      CREATE TEMP TABLE seed_alias_map (alias_normalized TEXT, country_code TEXT, seed_id UUID) ON COMMIT DROP;
      INSERT INTO seed_alias_map (alias_normalized, country_code, seed_id) VALUES
      ${seedAliasRows};

      FOR pair IN
        SELECT DISTINCT a.merchant_id AS dup_id, sam.seed_id
        FROM merchant_alias a
        JOIN seed_alias_map sam
          ON a.alias_normalized = sam.alias_normalized AND a.country_code = sam.country_code
        JOIN merchant d ON d.id = a.merchant_id
        JOIN merchant s ON s.id = sam.seed_id
        WHERE a.merchant_id <> sam.seed_id
          AND d.created_via <> 'SEED'
      LOOP
        UPDATE price_observation SET merchant_id = pair.seed_id WHERE merchant_id = pair.dup_id;
        UPDATE invoice          SET merchant_id = pair.seed_id WHERE merchant_id = pair.dup_id;
        UPDATE merchant_branch  SET merchant_id = pair.seed_id WHERE merchant_id = pair.dup_id;
        UPDATE product_alias    SET merchant_id = pair.seed_id WHERE merchant_id = pair.dup_id;

        -- Drop the duplicate's aliases that the seed merchant already owns (unique on
        -- alias_normalized + country_code), then reassign the remaining unique ones.
        DELETE FROM merchant_alias d_a
        USING merchant_alias s_a
        WHERE d_a.merchant_id = pair.dup_id
          AND s_a.merchant_id = pair.seed_id
          AND s_a.alias_normalized = d_a.alias_normalized
          AND s_a.country_code = d_a.country_code;
        UPDATE merchant_alias SET merchant_id = pair.seed_id WHERE merchant_id = pair.dup_id;

        DELETE FROM merchant WHERE id = pair.dup_id;
      END LOOP;
    END $$;
  `);
}

// No-op: a merge cannot be safely reversed (the duplicate identity is gone and its rows
// now belong to the seed merchant). up() is idempotent, so re-applying is harmless.
export async function down(): Promise<void> {}
