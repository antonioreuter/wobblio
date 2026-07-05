/* eslint-disable no-console */
// Dev-only demo seed for the Home inflation card (§6 Anti-Inflation Price Engine). Creates, for the
// target user, a matched personal basket across two 90-day windows plus a regional price history in
// their region, so `GET /me/insights/inflation` returns a real personal %, region %, 6-month trend,
// and switching savings instead of the honest "building" state.
//
// SAFETY: refuses any database whose name is not a dev marker (prod is `wobblio`, never touched).
// Idempotent: removes its own prior seed (tagged by IMAGE_KEY) before re-inserting.
//
// Run:  cd Source/infra && NODE_PATH="$PWD/node_modules" \
//         npx ts-node src/local/seed-inflation-demo.ts <cognito-sub>
import { randomBytes } from 'crypto';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

const AWS_REGION = 'eu-west-1';
const DEFAULT_SUB = '620524b4-5051-7057-a658-5848b76555b2'; // antonioreuter@gmail.com (dev)
const IMAGE_KEY = 'seed/inflation-demo.jpg'; // tag so the seed is identifiable + removable
const K_PER_MONTH = 4; // observations per (product, month) — clears the §6.8 k>=3 serving gate
const MONTHS = 6;

// 6 products the user actually buys, with a representative price (from assess3). paidPrice trends up
// prior->current (personal inflation); region price sits a touch above what they pay (savings).
const PRODUCTS = [
  { id: '44d598d4-95c6-4298-aae3-409acfe37232', cat: 'cat-accessories', base: 6.5, raw: 'ACCESSOIRE Kleur 1' },
  { id: 'daefc633-a9d4-4efc-9c83-ed677239b37f', cat: 'cat-furniture', base: 4.99, raw: 'kinder klapstoel' },
  { id: '848c1aba-139c-4c5d-850b-6a9ac9163f66', cat: 'cat-shoes', base: 4.49, raw: 'kinder clogs' },
  { id: '6722ffb9-832f-4476-a303-f89673425106', cat: 'cat-frozen', base: 4.22, raw: 'AH HAMBURGER' },
  { id: 'd8ff82fc-1028-46f6-98aa-39c94f26d161', cat: 'cat-skincare', base: 3.99, raw: 'PALMOLIVE DOUCHE' },
  { id: '541887e4-5491-4e28-93cf-810a2f3d63cd', cat: 'cat-meat-fish', base: 3.77, raw: 'JUMBO ACHTERHAM' },
];

const round2 = (n: number) => Math.round(n * 100) / 100;
const sha = () => randomBytes(32).toString('hex');

async function ssm(name: string): Promise<string> {
  const r = await new SSMClient({ region: AWS_REGION }).send(
    new GetParameterCommand({ Name: name, WithDecryption: true }),
  );
  return r.Parameter!.Value!;
}

async function connect(): Promise<{ client: Client; region: string; country: string; userId: string }> {
  const sub = process.argv[2] ?? DEFAULT_SUB;
  const [endpoint, port, arn] = await Promise.all([
    ssm('/shared/db/endpoint'),
    ssm('/shared/db/port'),
    ssm('/shared/db/wobblio_dev/secret-arn'),
  ]);
  const sec = JSON.parse(
    (await new SecretsManagerClient({ region: AWS_REGION }).send(
      new GetSecretValueCommand({ SecretId: arn }),
    )).SecretString!,
  );
  const dbname: string = sec.dbname ?? 'wobblio_dev';
  if (!/(?:^|[_-])dev(?:[_-]|$)/i.test(dbname)) throw new Error(`Refusing non-dev database "${dbname}"`);

  const client = new Client({
    host: sec.host ?? endpoint,
    port: Number(sec.port ?? port),
    user: sec.username,
    password: sec.password,
    database: dbname,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const live = (await client.query('SELECT current_database() db')).rows[0].db as string;
  if (!/(?:^|[_-])dev(?:[_-]|$)/i.test(live)) throw new Error(`Refusing non-dev connection "${live}"`);

  const user = (await client.query('SELECT * FROM resolve_app_user_by_cognito_sub($1)', [sub])).rows[0];
  if (!user) throw new Error(`No app_user for sub ${sub}`);
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [user.id]);
  const prof = (await client.query('SELECT country_code, region_code FROM app_user WHERE id=$1', [user.id])).rows[0];
  await client.query('COMMIT');
  const region = prof.region_code && prof.region_code.length ? prof.region_code : prof.country_code;
  return { client, region, country: prof.country_code, userId: user.id };
}

// One tagged invoice `daysAgo` back, with all 6 products at `factor`× their base price. Attributed to
// a real merchant so it reads as a normal receipt (not "Unknown merchant") in Recent/History.
async function insertInvoice(client: Client, userId: string, country: string, region: string, daysAgo: number, factor: number, merchantId: string) {
  const total = round2(PRODUCTS.reduce((s, p) => s + p.base * factor, 0));
  const inv = (await client.query(
    `INSERT INTO invoice (tenant_id, uploaded_by_user_id, merchant_id, status, transaction_date, currency, total,
        image_s3_key, image_sha256, location_country_code, location_region_code, location_status, location_source)
     VALUES ($1,$1,$8,'PARSED', CURRENT_DATE - $2::int, 'EUR', $3, $4, $5, $6, $7, 'RESOLVED', 'PROFILE')
     RETURNING id`,
    [userId, daysAgo, total, IMAGE_KEY, sha(), country, region, merchantId],
  )).rows[0].id as string;

  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    const lineTotal = round2(p.base * factor);
    await client.query(
      `INSERT INTO invoice_line (invoice_id, raw_text, product_id, category_id, quantity, line_total, line_index)
       VALUES ($1,$2,$3,$4,1,$5,$6)`,
      [inv, p.raw, p.id, p.cat, lineTotal, i],
    );
  }
  return { inv, total };
}

// Regional observations: K_PER_MONTH rows per product per month for MONTHS months, price rising over
// time (newest dearest) and set a touch above what the user pays, so region inflation is positive and
// the user shows real switching savings.
async function insertRegionObservations(client: Client, country: string, region: string) {
  // price_observation.merchant_id is NOT NULL; spread across a few real merchants so the "switching
  // shops" framing is honest. The inflation/savings queries don't filter by merchant.
  const merchants = (await client.query(
    `SELECT id FROM merchant WHERE country_code=$1 AND status='ACTIVE' LIMIT 3`, [country],
  )).rows.map((r) => r.id as string);
  if (merchants.length === 0) throw new Error(`No active merchants for ${country} to attribute observations to`);

  let rows = 0;
  for (const p of PRODUCTS) {
    for (let m = 0; m < MONTHS; m++) {
      const monthFactor = 1.08 - 0.02 * m; // m=0 (newest) dearest, older cheaper
      for (let k = 0; k < K_PER_MONTH; k++) {
        const jitter = 1 + (k - (K_PER_MONTH - 1) / 2) * 0.005;
        const packPrice = round2(p.base * monthFactor * jitter);
        const daysAgo = m * 30 + 5 + k * 3;
        await client.query(
          `INSERT INTO price_observation
             (product_id, merchant_id, country_code, region_code, observed_on, pack_price,
              normalized_unit_price, base_unit, currency, was_discounted, quality, quarantined,
              contributor_trust_at_write)
           VALUES ($1, $2, $3, $4, CURRENT_DATE - $5::int, $6, NULL, NULL, 'EUR', false, 'AUTO', false, 50)`,
          [p.id, merchants[k % merchants.length], country, region, daysAgo, packPrice],
        );
        rows++;
      }
    }
  }
  return rows;
}

async function clearPriorSeed(client: Client, userId: string, region: string) {
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [userId]);
  await client.query(
    `DELETE FROM invoice_line WHERE invoice_id IN
       (SELECT id FROM invoice WHERE tenant_id=$1 AND image_s3_key=$2)`, [userId, IMAGE_KEY]);
  const del = await client.query(
    `DELETE FROM invoice WHERE tenant_id=$1 AND image_s3_key=$2`, [userId, IMAGE_KEY]);
  await client.query('COMMIT');
  // De-identified store has no tenant ref; remove only this seed's fingerprint (trust=50 AUTO on our
  // 6 products in this region) so a re-run doesn't stack density.
  const ids = PRODUCTS.map((p) => p.id);
  const obs = await client.query(
    `DELETE FROM price_observation
      WHERE region_code=$1 AND contributor_trust_at_write=50 AND quality='AUTO'
        AND product_id = ANY($2::uuid[])`, [region, ids]);
  return { invoices: del.rowCount ?? 0, observations: obs.rowCount ?? 0 };
}

async function main() {
  const { client, region, country, userId } = await connect();
  try {
    const cleared = await clearPriorSeed(client, userId, region);
    console.log(`cleared prior seed: ${cleared.invoices} invoices, ${cleared.observations} observations`);

    const merchants = (await client.query(
      `SELECT id, brand_name FROM merchant WHERE country_code=$1 AND status='ACTIVE' ORDER BY brand_name LIMIT 2`,
      [country],
    )).rows;
    if (merchants.length < 2) throw new Error(`Need >=2 active ${country} merchants to attribute seed invoices`);

    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [userId]);
    const prior = await insertInvoice(client, userId, country, region, 120, 0.9, merchants[0].id); // ~4 months ago
    const current = await insertInvoice(client, userId, country, region, 15, 0.97, merchants[1].id); // ~2 weeks ago
    await client.query('COMMIT');
    console.log(`personal: 2 invoices (prior €${prior.total} @-120d @${merchants[0].brand_name}, current €${current.total} @-15d @${merchants[1].brand_name}), 12 lines`);

    const obsRows = await insertRegionObservations(client, country, region);
    console.log(`region ${region}: ${obsRows} price observations across ${MONTHS} months`);
    console.log('done — reload the Home screen. To remove: re-run clears it, or npm run reset:dev.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('SEED FAILED:', e.message);
  process.exit(1);
});
