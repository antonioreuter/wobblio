import type { MigrationBuilder } from 'node-pg-migrate';

// Brazilian merchant priors — the BR counterpart to 20260620120000_seed_merchants (NL).
// Same rationale (§6.2 / §6.4): seed the dominant chains so an invoice whose line-item vote
// has no clear majority still has a merchant prior at zero AI cost, and so the venue tags in
// TAG_VOCABULARY (which exact-match merchant.brand_name) actually fire for BR receipts.
//
// National chains plus regional supermarkets from São Paulo, Bahia, and Rio de Janeiro, and the
// major non-grocery national retailers (fashion, electronics, marketplaces, sporting goods,
// department stores). One merchant row per (brand, country).
//
// Like 20260620120000_seed_merchants, this is a self-contained, immutable snapshot mirroring
// src/local/seeds/merchant-aliases.ts. Migrations must not import mutable app code, so
// MERCHANT_SEEDS and normalizeAlias are re-declared here; seed_merchants.test.ts pins this
// snapshot to the local seed AND to the backend's normalizeMerchantName so the copies can never
// drift. Inserts are idempotent (ON CONFLICT) and safe to re-run.

export interface MerchantSeedRow {
  id: string;
  brand_name: string;
  country_code: string;
  default_category_id: string;
  website: string | null;
  aliases: string[];
}

export const MERCHANT_SEEDS: MerchantSeedRow[] = [
  // Supermarkets — national.
  { id: '01900000-0002-7000-8000-000000000001', brand_name: 'Pão de Açúcar', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.paodeacucar.com', aliases: ['PAO DE ACUCAR', 'PAODEACUCAR'] },
  { id: '01900000-0002-7000-8000-000000000002', brand_name: 'Carrefour', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.carrefour.com.br', aliases: ['CARREFOUR', 'CARREFOUR EXPRESS', 'CARREFOUR BAIRRO', 'CARREFOUR HIPER', 'CARREFOUR MERCADO'] },
  { id: '01900000-0002-7000-8000-000000000003', brand_name: 'Extra', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.extra.com.br', aliases: ['EXTRA', 'EXTRA MERCADO', 'EXTRA HIPER', 'EXTRA SUPERMERCADO'] },
  { id: '01900000-0002-7000-8000-000000000004', brand_name: 'Dia', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.dia.com.br', aliases: ['DIA', 'DIA SUPERMERCADO', 'SUPERMERCADO DIA'] },
  // Supermarkets — São Paulo.
  { id: '01900000-0002-7000-8000-000000000005', brand_name: 'St Marche', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.marche.com.br', aliases: ['ST MARCHE', 'SAINT MARCHE', 'MARCHE'] },
  { id: '01900000-0002-7000-8000-000000000006', brand_name: 'Sonda', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.sondasupermercados.com.br', aliases: ['SONDA', 'SONDA SUPERMERCADOS'] },
  { id: '01900000-0002-7000-8000-000000000007', brand_name: 'Oba Hortifruti', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.obahortifruti.com.br', aliases: ['OBA', 'OBA HORTIFRUTI', 'HORTIFRUTI OBA'] },
  // Supermarkets — Bahia.
  { id: '01900000-0002-7000-8000-000000000008', brand_name: 'GBarbosa', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.gbarbosa.com.br', aliases: ['GBARBOSA', 'G BARBOSA'] },
  { id: '01900000-0002-7000-8000-000000000009', brand_name: 'Hiperideal', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.hiperideal.com.br', aliases: ['HIPERIDEAL', 'HIPER IDEAL'] },
  { id: '01900000-0002-7000-8000-000000000010', brand_name: 'Bompreço', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.bompreco.com.br', aliases: ['BOMPRECO', 'BOM PRECO'] },
  // Supermarkets — Rio de Janeiro.
  { id: '01900000-0002-7000-8000-000000000011', brand_name: 'Guanabara', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.supermercadosguanabara.com.br', aliases: ['GUANABARA', 'SUPERMERCADOS GUANABARA'] },
  { id: '01900000-0002-7000-8000-000000000012', brand_name: 'Prezunic', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.prezunic.com.br', aliases: ['PREZUNIC', 'PREZUNIC SUPERMERCADOS'] },
  { id: '01900000-0002-7000-8000-000000000013', brand_name: 'Zona Sul', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.zonasul.com.br', aliases: ['ZONA SUL', 'SUPERMERCADO ZONA SUL'] },
  { id: '01900000-0002-7000-8000-000000000014', brand_name: 'Mundial', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.supermercadosmundial.com.br', aliases: ['MUNDIAL', 'SUPERMERCADOS MUNDIAL'] },
  // Cash-and-carry (atacado).
  { id: '01900000-0002-7000-8000-000000000015', brand_name: 'Atacadão', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.atacadao.com.br', aliases: ['ATACADAO'] },
  { id: '01900000-0002-7000-8000-000000000016', brand_name: 'Assaí Atacadista', country_code: 'BR', default_category_id: 'cat-groceries', website: 'https://www.assai.com.br', aliases: ['ASSAI', 'ASSAI ATACADISTA'] },
  // Farmácias.
  { id: '01900000-0002-7000-8000-000000000017', brand_name: 'Drogaria São Paulo', country_code: 'BR', default_category_id: 'cat-personal-care', website: 'https://www.drogariasaopaulo.com.br', aliases: ['DROGARIA SAO PAULO', 'DROGARIAS SAO PAULO'] },
  { id: '01900000-0002-7000-8000-000000000018', brand_name: 'Drogasil', country_code: 'BR', default_category_id: 'cat-personal-care', website: 'https://www.drogasil.com.br', aliases: ['DROGASIL'] },
  { id: '01900000-0002-7000-8000-000000000019', brand_name: 'Droga Raia', country_code: 'BR', default_category_id: 'cat-personal-care', website: 'https://www.drogaraia.com.br', aliases: ['DROGA RAIA', 'DROGARAIA', 'RAIA'] },
  { id: '01900000-0002-7000-8000-000000000020', brand_name: 'Pague Menos', country_code: 'BR', default_category_id: 'cat-personal-care', website: 'https://www.paguemenos.com.br', aliases: ['PAGUE MENOS', 'FARMACIA PAGUE MENOS'] },
  { id: '01900000-0002-7000-8000-000000000021', brand_name: 'Drogarias Pacheco', country_code: 'BR', default_category_id: 'cat-personal-care', website: 'https://www.drogariaspacheco.com.br', aliases: ['DROGARIAS PACHECO', 'DROGARIA PACHECO', 'PACHECO'] },
  // Fashion retail.
  { id: '01900000-0002-7000-8000-000000000022', brand_name: 'Zara', country_code: 'BR', default_category_id: 'cat-clothing', website: 'https://www.zara.com/br', aliases: ['ZARA', 'ZARA BRASIL'] },
  { id: '01900000-0002-7000-8000-000000000023', brand_name: 'C&A', country_code: 'BR', default_category_id: 'cat-clothing', website: 'https://www.cea.com.br', aliases: ['C A', 'CEA', 'CEA MODAS'] },
  { id: '01900000-0002-7000-8000-000000000024', brand_name: 'Renner', country_code: 'BR', default_category_id: 'cat-clothing', website: 'https://www.lojasrenner.com.br', aliases: ['RENNER', 'LOJAS RENNER'] },
  { id: '01900000-0002-7000-8000-000000000025', brand_name: 'Riachuelo', country_code: 'BR', default_category_id: 'cat-clothing', website: 'https://www.riachuelo.com.br', aliases: ['RIACHUELO', 'LOJAS RIACHUELO'] },
  { id: '01900000-0002-7000-8000-000000000026', brand_name: 'Marisa', country_code: 'BR', default_category_id: 'cat-clothing', website: 'https://www.marisa.com.br', aliases: ['MARISA', 'LOJAS MARISA'] },
  { id: '01900000-0002-7000-8000-000000000027', brand_name: 'Hering', country_code: 'BR', default_category_id: 'cat-clothing', website: 'https://www.hering.com.br', aliases: ['HERING', 'LOJA HERING'] },
  // Electronics / appliances.
  { id: '01900000-0002-7000-8000-000000000028', brand_name: 'Fast Shop', country_code: 'BR', default_category_id: 'cat-electronics', website: 'https://www.fastshop.com.br', aliases: ['FAST SHOP', 'FASTSHOP'] },
  { id: '01900000-0002-7000-8000-000000000029', brand_name: 'Casas Bahia', country_code: 'BR', default_category_id: 'cat-electronics', website: 'https://www.casasbahia.com.br', aliases: ['CASAS BAHIA', 'CASA BAHIA'] },
  { id: '01900000-0002-7000-8000-000000000030', brand_name: 'Ponto', country_code: 'BR', default_category_id: 'cat-electronics', website: 'https://www.pontofrio.com.br', aliases: ['PONTO', 'PONTO FRIO', 'PONTOFRIO'] },
  { id: '01900000-0002-7000-8000-000000000031', brand_name: 'Magazine Luiza', country_code: 'BR', default_category_id: 'cat-electronics', website: 'https://www.magazineluiza.com.br', aliases: ['MAGAZINE LUIZA', 'MAGALU'] },
  { id: '01900000-0002-7000-8000-000000000032', brand_name: 'Kabum', country_code: 'BR', default_category_id: 'cat-electronics', website: 'https://www.kabum.com.br', aliases: ['KABUM'] },
  // Online marketplaces (sell across categories → cat-other prior).
  { id: '01900000-0002-7000-8000-000000000033', brand_name: 'Amazon.com.br', country_code: 'BR', default_category_id: 'cat-other', website: 'https://www.amazon.com.br', aliases: ['AMAZON', 'AMAZON.COM.BR', 'AMAZON BR'] },
  { id: '01900000-0002-7000-8000-000000000034', brand_name: 'Mercado Livre', country_code: 'BR', default_category_id: 'cat-other', website: 'https://www.mercadolivre.com.br', aliases: ['MERCADO LIVRE', 'MERCADOLIVRE', 'MERCADO LIVRE BRASIL'] },
  // Sporting goods (apparel-heavy → cat-clothing prior).
  { id: '01900000-0002-7000-8000-000000000035', brand_name: 'Centauro', country_code: 'BR', default_category_id: 'cat-clothing', website: 'https://www.centauro.com.br', aliases: ['CENTAURO', 'LOJAS CENTAURO'] },
  { id: '01900000-0002-7000-8000-000000000036', brand_name: 'Decathlon', country_code: 'BR', default_category_id: 'cat-clothing', website: 'https://www.decathlon.com.br', aliases: ['DECATHLON', 'DECATHLON BRASIL'] },
  // Department / variety stores (mixed assortment → cat-other prior, like NL Action).
  { id: '01900000-0002-7000-8000-000000000037', brand_name: 'Americanas', country_code: 'BR', default_category_id: 'cat-other', website: 'https://www.americanas.com.br', aliases: ['AMERICANAS', 'LOJAS AMERICANAS'] },
  { id: '01900000-0002-7000-8000-000000000038', brand_name: 'Havan', country_code: 'BR', default_category_id: 'cat-other', website: 'https://www.havan.com.br', aliases: ['HAVAN', 'LOJAS HAVAN'] },
];

// Frozen copy of the backend's normalizeMerchantName (§6.2). Pinned to the runtime
// implementation by seed_merchants.test.ts. Includes the Brazilian legal-entity suffixes
// (LTDA, EIRELI) so receipt footers like "CARREFOUR COMERCIO LTDA" collapse to the seeded alias.
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

  // Heal pre-existing AUTO merchants that already own one of these aliases (an earlier BR
  // ingestion before this seed): backfill the category prior where it is still missing,
  // without merging merchant identities (existing invoices keep their merchant_id).
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
// invoices via merchant_id. up() is idempotent so re-applying is safe.
export async function down(): Promise<void> {}
