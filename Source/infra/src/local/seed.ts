import * as fs from 'fs';
import { Client } from 'pg';
import { merchantSeeds, normalizeMerchantAlias } from './seeds/merchant-aliases';
import { categorySeed } from './seeds/product-taxonomy';
import { countrySeed, subdivisionSeed } from './seeds/country-subdivisions';
import { seedSsmParameters } from './seeds/ssm-parameters';

// RDS requires TLS; local Postgres does not. Verify by default — pass the RDS CA
// bundle via DB_SSL_CA (path or PEM). DB_SSL_NO_VERIFY exists only as an explicit
// escape hatch for throwaway debugging and must never be used against real data.
export function buildSslConfig(): false | boolean | { ca?: string; rejectUnauthorized?: boolean } {
  if (process.env.DB_SSL !== 'true') return false;
  const ca = process.env.DB_SSL_CA;
  if (ca) return { ca: fs.existsSync(ca) ? fs.readFileSync(ca, 'utf8') : ca };
  if (process.env.DB_SSL_NO_VERIFY === 'true') return { rejectUnauthorized: false };
  return true;
}

export function buildDbClient(): Client {
  return new Client({
    connectionString:
      process.env.DATABASE_URL ??
      `postgres://${process.env.DB_USER ?? 'wobblio_dev'}:${process.env.DB_PASSWORD ?? 'wobblio_dev_secret'}@${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '5432'}/${process.env.DB_NAME ?? 'wobblio_local'}`,
    ssl: buildSslConfig(),
  });
}

async function tableExists(client: Client, tableName: string): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    )`,
    [tableName]
  );
  return result.rows[0].exists as boolean;
}

export async function seedMerchants(client: Client): Promise<void> {
  if (!(await tableExists(client, 'merchant'))) {
    console.warn('  ⚠  Table "merchant" does not exist — skipping. Run migrations first.');
    return;
  }

  console.log('  Seeding merchants...');
  for (const m of merchantSeeds) {
    await client.query(
      `INSERT INTO merchant (id, brand_name, country_code, default_category_id, website, created_via, status)
       VALUES ($1, $2, $3, $4, $5, 'SEED', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET default_category_id = EXCLUDED.default_category_id`,
      [m.id, m.brand_name, m.country_code, m.default_category_id, m.website]
    );
  }
  console.log(`  ✓ ${merchantSeeds.length} merchants`);

  if (!(await tableExists(client, 'merchant_alias'))) {
    console.warn('  ⚠  Table "merchant_alias" does not exist — skipping aliases.');
    return;
  }

  let aliasCount = 0;
  for (const m of merchantSeeds) {
    for (const alias of m.aliases) {
      await client.query(
        `INSERT INTO merchant_alias (merchant_id, alias_raw, alias_normalized, country_code, source)
         VALUES ($1, $2, $3, $4, 'SEED')
         ON CONFLICT (alias_normalized, country_code) DO NOTHING`,
        [m.id, alias, normalizeMerchantAlias(alias), m.country_code]
      );
      aliasCount++;
    }
  }
  console.log(`  ✓ ${aliasCount} merchant aliases`);
}

export async function seedTaxonomy(client: Client): Promise<void> {
  if (!(await tableExists(client, 'product_category'))) {
    console.warn('  ⚠  Table "product_category" does not exist — skipping. Run migrations first.');
    return;
  }

  console.log('  Seeding product taxonomy...');
  for (const cat of categorySeed) {
    await client.query(
      `INSERT INTO product_category (id, parent_id, name, name_nl, level)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [cat.id, cat.parent_id, cat.name, cat.name_nl, cat.level]
    );
  }
  console.log(`  ✓ ${categorySeed.length} product categories`);
}

export async function seedReference(client: Client): Promise<void> {
  if (!(await tableExists(client, 'country'))) {
    console.warn('  ⚠  Table "country" does not exist — skipping. Run migrations first.');
    return;
  }

  console.log('  Seeding ISO 3166 reference data...');
  for (const c of countrySeed) {
    await client.query(
      `INSERT INTO country (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
      [c.code, c.name]
    );
  }
  for (const s of subdivisionSeed) {
    await client.query(
      `INSERT INTO country_subdivision (code, country_code, name)
       VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING`,
      [s.code, s.country_code, s.name]
    );
  }
  console.log(`  ✓ ${countrySeed.length} countries, ${subdivisionSeed.length} subdivisions`);
}

// Seed the global reference + catalog tables on an already-connected client (caller owns
// connect/end so the reset script can reuse it). Order matters: taxonomy before merchants,
// because merchant.default_category_id references product_category — seeding merchants
// first would fail against a freshly-truncated category table. All inserts are idempotent.
export async function seedPostgres(client: Client): Promise<void> {
  console.log('\nSeeding PostgreSQL...');
  await seedReference(client);
  await seedTaxonomy(client);
  await seedMerchants(client);
  console.log('PostgreSQL seed complete.\n');
}

async function main(): Promise<void> {
  // SSM seeding writes mock model IDs and is for local only — real stages manage
  // these parameters via deploy/ops, so seeding them here would clobber live config.
  const stage = process.env.STAGE ?? 'local';
  if (stage === 'local') {
    await seedSsmParameters();
  } else {
    console.log(`Skipping SSM parameter seeding (STAGE=${stage} — reference data only).`);
  }
  const client = buildDbClient();
  await client.connect();
  try {
    await seedPostgres(client);
  } finally {
    await client.end();
  }
  console.log('All seed operations complete.');
}

// Only run as a CLI; importing for reuse (reset-dev.ts) must not trigger a seed.
if (require.main === module) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
