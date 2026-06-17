/**
 * Local Epic-08 end-to-end harness — dev only, NOT shipped.
 *
 * Drives the REAL IngestionService pipeline against real local Postgres + the real
 * Ollama embedder (nomic-embed-text → pgvector) + real Stage-5 price-observation
 * writes. Only the LLM *text* stages (vision parse, product expansion) are faked
 * with deterministic JSON, because no vision/chat model is pulled locally — the
 * embedder, catalogs, classification, tagging, and emission all run for real.
 *
 * Run: cd Source/backend && STAGE=local npx ts-node -r tsconfig-paths/register \
 *        src/local/e2e-data-intelligence.ts
 */
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../config/local.env') });
// This machine runs Ollama locally; the committed config points at the network box.
process.env.OLLAMA_BASE_URL = 'http://localhost:11434';

import { Pool, type PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';
import { IngestionLedgerAdapter } from '@infrastructure/adapters/ingestion/IngestionLedgerAdapter';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/ingestion/InvoiceRepositoryAdapter';
import { MerchantCatalogAdapter } from '@infrastructure/adapters/data-intelligence/MerchantCatalogAdapter';
import { ProductCatalogAdapter } from '@infrastructure/adapters/data-intelligence/ProductCatalogAdapter';
import { PriceObservationStoreAdapter } from '@infrastructure/adapters/data-intelligence/PriceObservationStoreAdapter';
import { ContributorContextRepositoryAdapter } from '@infrastructure/adapters/data-intelligence/ContributorContextRepositoryAdapter';
import { RegionReferenceAdapter } from '@infrastructure/adapters/data-intelligence/RegionReferenceAdapter';
import { OllamaEmbedderAdapter } from '@infrastructure/adapters/data-intelligence/OllamaEmbedderAdapter';
import { AiSpendLedgerAdapter } from '@infrastructure/adapters/ai/AiSpendLedgerAdapter';
import { BedrockSpendGuardService } from '@core/services/ai/BedrockSpendGuardService';
import { MerchantResolver } from '@core/services/data-intelligence/MerchantResolver';
import { ProductNormalizer } from '@core/services/data-intelligence/ProductNormalizer';
import { InvoiceClassifier } from '@core/services/data-intelligence/InvoiceClassifier';
import { TagGenerator } from '@core/services/data-intelligence/TagGenerator';
import { IngestionService } from '@core/services/ingestion/IngestionService';
import type { VisionParseService } from '@core/services/ingestion/VisionParseService';
import type { IBedrockConverse, BedrockConverseRequest, BedrockConverseResult } from '@core/ports/ai/IBedrockConverse';
import type { IS3FileStorage } from '@core/ports/ingestion/IS3FileStorage';
import type { IAiSpendCapProvider } from '@core/ports/ai/IAiSpendCapProvider';
import type { ParsedReceipt } from '@core/domain/ingestion';

const MILK = 1 + Math.round(Math.random() * 200) / 100; // vary so re-runs aren't fuzzy-duplicates
const BANANAS = 2.49;
const DEPOSIT = 0.25;
const RUN = randomUUID().slice(0, 8); // unique per execution → products are freshly embedded each run

const fixtureReceipt = (): ParsedReceipt => ({
  merchantRaw: 'Albert Heijn',
  transactionDate: '2026-06-10',
  currency: 'EUR',
  total: Number((MILK + BANANAS + DEPOSIT).toFixed(2)),
  lines: [
    { rawText: `AH Halfvolle Melk 1L ${RUN}`, quantity: 1, lineTotal: MILK, unitSizeRaw: '1L' },
    { rawText: `AH Bananen ${RUN}`, quantity: 1, lineTotal: BANANAS },
    { rawText: 'Statiegeld', quantity: 1, lineTotal: DEPOSIT },
  ],
  parseConfidence: 0.95,
});

// Map a raw line to a canonical item the way the chat model would. Sized to the
// exact lines the normalizer asks to expand (only the unmatched ones).
function itemFor(text: string): Record<string, unknown> {
  if (/statiegeld/i.test(text)) return { display_name: text, category_id: 'cat-other', base_unit: 'PIECE', pack_size_base_units: null, is_deposit_or_fee: true };
  if (/melk/i.test(text)) return { display_name: text, category_id: 'cat-dairy', base_unit: 'L', pack_size_base_units: 1, is_deposit_or_fee: false };
  if (/banan/i.test(text)) return { display_name: text, category_id: 'cat-produce', base_unit: 'KG', pack_size_base_units: 1, is_deposit_or_fee: false };
  return { display_name: text, category_id: 'cat-other', base_unit: 'PIECE', pack_size_base_units: 1, is_deposit_or_fee: false };
}

function expansionFor(req: BedrockConverseRequest): string {
  const userMessage = req.messages.map(m => m.content).join('\n');
  const texts = [...userMessage.matchAll(/<line[^>]*>([^<]*)<\/line>/g)].map(m => m[1]);
  return JSON.stringify({ items: texts.map(itemFor), suggested_tags: ['dairy', 'organic'] });
}

// Deterministic stand-in for the chat model: only PRODUCT_EXPANSION is reached here
// (merchant is an exact alias hit; classification uses the merchant prior).
const fakeConverse: IBedrockConverse = {
  async converse(req: BedrockConverseRequest): Promise<BedrockConverseResult> {
    const content = req.stage === 'PRODUCT_EXPANSION' ? expansionFor(req) : '{}';
    return { content, inputTokens: 10, outputTokens: 40, modelId: 'fake-local', durationMs: 1 };
  },
};

const fakeCap: IAiSpendCapProvider = { async getDailyCapEur() { return 100; } };

const fakeStorage: IS3FileStorage = {
  async presignPut() { return 'x'; },
  async presignGet() { return 'x'; },
  async headExists() { return true; },
  async getObjectBytes() { return new Uint8Array([0xff, 0xd8, 0xff]); }, // bytes unused by the fake vision parser
  async deleteObject() { /* no-op */ },
};

const fakeVisionParser = { async parse() { return fixtureReceipt(); } } as unknown as VisionParseService;

async function provisionTenant(pool: Pool, optedOut: boolean): Promise<string> {
  const sub = `e2e-${randomUUID()}`;
  const result = await pool.query<{ id: string }>(
    `INSERT INTO app_user (cognito_sub, email, status, country_code, region_code, price_contribution_optout)
     VALUES ($1, $2, 'ACTIVE', 'NL', 'NL-NB', $3) RETURNING id`,
    [sub, `${sub}@test.nl`, optedOut],
  );
  return result.rows[0].id;
}

async function countObservations(pool: Pool): Promise<number> {
  const r = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM price_observation`);
  return parseInt(r.rows[0].n, 10);
}

function buildService(client: PoolClient): IngestionService {
  const spendGuard = new BedrockSpendGuardService(fakeConverse, new AiSpendLedgerAdapter(client), fakeCap);
  const embedder = new OllamaEmbedderAdapter(process.env.OLLAMA_BASE_URL!, 'nomic-embed-text');
  return new IngestionService(
    new TenantContextAdapter(client),
    new IngestionLedgerAdapter(client),
    fakeStorage,
    fakeVisionParser,
    new MerchantResolver(new MerchantCatalogAdapter(client), spendGuard, 'fake-local'),
    new ProductNormalizer(new ProductCatalogAdapter(client), embedder, spendGuard, 'fake-local'),
    new InvoiceClassifier(new MerchantCatalogAdapter(client), spendGuard, 'fake-local'),
    new TagGenerator(),
    new InvoiceRepositoryAdapter(client),
    new PriceObservationStoreAdapter(client),
    new ContributorContextRepositoryAdapter(client),
    new RegionReferenceAdapter(client),
  );
}

async function runOnce(pool: Pool, tenantId: string): Promise<string> {
  const client = await pool.connect();
  const sha = randomUUID().replace(/-/g, '');
  const s3Key = `receipts/${tenantId}/${sha}.jpg`;
  try {
    await client.query('BEGIN');
    await new TenantContextAdapter(client).setTenantId(tenantId);
    const invoiceId = await new InvoiceRepositoryAdapter(client).createPending({
      tenantId, uploadedByUserId: tenantId, householdId: null, imageS3Key: s3Key, imageSha256: sha,
    });
    const outcome = await buildService(client).process({ tenantId, invoiceId, s3Key });
    await client.query('COMMIT');
    console.log(`  → processed invoice ${invoiceId}: handled=${outcome.handled} status=${outcome.status}`);
    return invoiceId;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

function assert(label: string, cond: boolean): void {
  console.log(`  ${cond ? '✓' : '✗ FAIL'} ${label}`);
  if (!cond) process.exitCode = 1;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 2 });
  try {
    console.log('\n[1] Opt-in contributor — full enrichment + price-observation emission');
    const before = await countObservations(pool);
    const tenantA = await provisionTenant(pool, false);
    const invoiceId = await runOnce(pool, tenantA);

    const inv = await pool.query<{ status: string; category_id: string | null; search_tags: string[] }>(
      `SELECT status, category_id, search_tags FROM invoice WHERE id = $1`, [invoiceId],
    );
    const lines = await pool.query<{ product_id: string | null; normalized_unit_price: string | null; is_deposit_or_fee: boolean }>(
      `SELECT product_id, normalized_unit_price::text, is_deposit_or_fee FROM invoice_line WHERE invoice_id = $1 ORDER BY id`, [invoiceId],
    );
    const products = await pool.query<{ status: string; has_embedding: boolean }>(
      `SELECT p.status, (p.embedding IS NOT NULL) AS has_embedding
       FROM product p JOIN invoice_line l ON l.product_id = p.id WHERE l.invoice_id = $1`, [invoiceId],
    );
    const after = await countObservations(pool);

    // PARSED or NEEDS_REVIEW are both valid completed-enrichment outcomes; a low-
    // confidence embedding match against accumulated catalog data flags NEEDS_REVIEW.
    assert(`invoice reached a terminal enriched status (got ${inv.rows[0]?.status})`, ['PARSED', 'NEEDS_REVIEW'].includes(inv.rows[0]?.status));
    assert(`invoice classified (category=${inv.rows[0]?.category_id})`, inv.rows[0]?.category_id !== null);
    assert(`search tags generated (${JSON.stringify(inv.rows[0]?.search_tags)})`, (inv.rows[0]?.search_tags ?? []).length > 0);
    assert('3 invoice lines persisted', lines.rowCount === 3);
    assert('2 product lines linked to catalog products', lines.rows.filter(l => l.product_id !== null).length === 2);
    assert('deposit line carries no product', lines.rows.some(l => l.is_deposit_or_fee && l.product_id === null));
    assert('provisional products created with real embeddings', products.rows.length === 2 && products.rows.every(p => p.status === 'PROVISIONAL' && p.has_embedding));

    const newObs = await pool.query<{ region_code: string; quarantined: boolean; normalized_unit_price: string }>(
      `SELECT region_code, quarantined, normalized_unit_price::text FROM price_observation ORDER BY id DESC LIMIT 2`,
    );
    assert(`2 price observations emitted (delta ${after - before})`, after - before === 2);
    assert('observations use the contributor ISO region NL-NB', newObs.rows.every(o => o.region_code === 'NL-NB'));
    assert('observations quarantined (provisional catalog entries)', newObs.rows.every(o => o.quarantined === true));

    console.log('\n[2] Opted-out contributor — no emission');
    const optOutBefore = await countObservations(pool);
    const tenantB = await provisionTenant(pool, true);
    await runOnce(pool, tenantB);
    const optOutAfter = await countObservations(pool);
    assert(`opt-out suppresses emission (delta ${optOutAfter - optOutBefore})`, optOutAfter - optOutBefore === 0);

    console.log(process.exitCode === 1 ? '\n✗ E2E FAILED\n' : '\n✓ E2E PASSED\n');
  } finally {
    await pool.end();
  }
}

void main();
