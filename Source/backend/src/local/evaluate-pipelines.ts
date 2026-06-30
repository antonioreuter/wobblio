/**
 * Offline pipeline evaluation harness — dev only (Non-Functional 01 · 07).
 *
 * Runs every fixture in invoices/fixtures/evaluation-set/ through BOTH ingestion pipelines
 * (LEGACY + STRANDS) in dry-run — each pipeline's extract() seam, no finalize, so nothing is
 * persisted and no price observations are emitted. Each run executes inside a transaction that
 * is ROLLED BACK, so the idempotency claim and any provisional catalog write-backs are discarded
 * too (pure dry-run). A more capable model (the `insight` role) then grades both outputs against
 * the curated ground truth (LLM-as-a-judge), and the script prints a comparative summary table.
 *
 * Requires the local stack (LocalStack S3 + local Postgres with reference/catalog data) and the
 * dev AWS profile for Bedrock. Real model calls cost tokens.
 *
 * Usage:
 *   cd Source/backend
 *   npm run compare:pipelines
 */
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../config/local.env') });

import { Pool, type PoolClient } from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SsmModelRegistryAdapter } from '@infrastructure/adapters/ai/SsmModelRegistryAdapter';
import { BedrockConverseAdapter } from '@infrastructure/adapters/ai/BedrockConverseAdapter';
import { BedrockTitanEmbedderAdapter } from '@infrastructure/adapters/data-intelligence/BedrockTitanEmbedderAdapter';
import { runPipeline, type EvalDeps, type PipelineRun } from './evaluation/processors';
import { judgePipelines } from './evaluation/judge';
import {
  summarizePipelineEval,
  renderSummaryTable,
  type FixtureEvaluation,
} from '@core/domain/pipelineEvalSummary';
import type { IngestionMessage } from '@core/ports/ingestion/IIngestionQueue';
import type { PipelineType } from '@handlers/shared/ingestionWorkerShell';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';
const FIXTURE_DIR = path.resolve(__dirname, '../../../../invoices/fixtures/evaluation-set');
const EXT_TO_TYPE: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };

interface Fixture {
  name: string;
  imagePath: string;
  groundTruth: unknown;
}

function ownerPool(): Pool {
  return new Pool({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'wobblio_local',
    user: process.env.DB_USER ?? 'wobblio_dev',
    password: 'wobblio_dev_secret',
    max: 2,
  });
}

async function ensureTenant(pool: Pool): Promise<string> {
  await pool.query(
    `INSERT INTO app_user (cognito_sub, email, status) VALUES ($1, $2, 'ACTIVE')
     ON CONFLICT (cognito_sub) DO NOTHING`,
    ['sub-eval-local', 'eval@local.test'],
  );
  const r = await pool.query<{ id: string }>(`SELECT id FROM app_user WHERE cognito_sub = $1`, ['sub-eval-local']);
  return r.rows[0].id;
}

// Each fixture is an image plus a sibling <name>.truth.json curated ground-truth file.
function loadFixtures(): Fixture[] {
  if (!fs.existsSync(FIXTURE_DIR)) throw new Error(`fixture dir not found: ${FIXTURE_DIR}`);
  return fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => /\.(jpe?g|png|pdf)$/i.test(f))
    .map((file) => {
      const name = file.replace(/\.[^.]+$/, '');
      const truthPath = path.join(FIXTURE_DIR, `${name}.truth.json`);
      if (!fs.existsSync(truthPath)) throw new Error(`missing ground truth for ${file}: ${name}.truth.json`);
      return {
        name,
        imagePath: path.join(FIXTURE_DIR, file),
        groundTruth: JSON.parse(fs.readFileSync(truthPath, 'utf-8')),
      };
    });
}

// Dry-run a single pipeline inside a transaction that is always rolled back, so the ledger
// claim and any provisional catalog writes never persist.
async function dryRun(pool: Pool, pipeline: PipelineType, deps: EvalDeps, message: IngestionMessage): Promise<PipelineRun> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    return await runPipeline(pipeline, client, deps, message);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
}

async function uploadFixture(s3: S3Client, bucket: string, fixture: Fixture, tenant: string): Promise<{ message: IngestionMessage }> {
  const bytes = fs.readFileSync(fixture.imagePath);
  const ext = path.extname(fixture.imagePath).slice(1).toLowerCase();
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const s3Key = `receipts/${tenant}/${sha}.${ext}`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: s3Key, Body: bytes, ContentType: EXT_TO_TYPE[ext] ?? 'image/jpeg' }));
  return { message: { invoiceId: crypto.randomUUID(), tenantId: tenant, s3Key } };
}

async function main(): Promise<void> {
  const fixtures = loadFixtures();
  if (fixtures.length === 0) {
    console.error('[eval] no fixtures found in', FIXTURE_DIR);
    process.exit(1);
  }

  const pool = ownerPool();
  const tenant = await ensureTenant(pool);
  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  const s3 = new S3Client({
    region: REGION,
    endpoint: process.env.AWS_ENDPOINT_URL_S3 ?? process.env.AWS_ENDPOINT_URL,
    forcePathStyle: true,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });

  const registry = new SsmModelRegistryAdapter(REGION);
  const modelIds = {
    vision: await registry.getModelId('vision_parser'),
    pdf: await registry.getModelId('pdf_parser'),
    auxiliary: await registry.getModelId('auxiliary'),
    embedder: await registry.getModelId('embedder'),
  };
  const insightModelId = await registry.getModelId('insight');
  const converse = new BedrockConverseAdapter(REGION);
  const embedder = new BedrockTitanEmbedderAdapter(REGION, modelIds.embedder);
  const deps: EvalDeps = { region: REGION, uploadsBucket, modelIds, converse, embedder };

  // Each fixture is isolated: a Bedrock error or a judge that fails schema twice skips that
  // fixture (already-graded results are kept and still summarised) instead of aborting the run.
  const evaluations: FixtureEvaluation[] = [];
  for (const fixture of fixtures) {
    try {
      const evaluation = await evaluateFixture(s3, uploadsBucket, tenant, pool, deps, converse, insightModelId, fixture);
      if (evaluation) evaluations.push(evaluation);
    } catch (err) {
      console.warn(`[eval] skipped ${fixture.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('\n' + renderSummaryTable(summarizePipelineEval(evaluations)));
  await pool.end();
}

async function evaluateFixture(
  s3: S3Client,
  uploadsBucket: string,
  tenant: string,
  pool: Pool,
  deps: EvalDeps,
  converse: BedrockConverseAdapter,
  insightModelId: string,
  fixture: Fixture,
): Promise<FixtureEvaluation | null> {
  console.log(`\n[eval] ${fixture.name} …`);
  const { message } = await uploadFixture(s3, uploadsBucket, fixture, tenant);

  const legacy = await dryRun(pool, 'LEGACY', deps, message);
  const agentic = await dryRun(pool, 'STRANDS', deps, message);
  if (legacy.outcome !== 'ready' || !legacy.extraction || agentic.outcome !== 'ready' || !agentic.extraction) {
    console.warn(`[eval] skipped ${fixture.name}: legacy=${legacy.outcome}, agentic=${agentic.outcome}`);
    return null;
  }

  const judgement = await judgePipelines(converse, insightModelId, fixture.groundTruth, legacy.extraction, agentic.extraction);
  console.log(`[eval] ${fixture.name}: legacy ${legacy.metrics.processingMs}ms / $${legacy.metrics.costUsd.toFixed(4)}, ` +
    `agentic ${agentic.metrics.processingMs}ms / $${agentic.metrics.costUsd.toFixed(4)}`);
  console.log(`[eval] judge: ${judgement.analysis}`);

  return { fixture: fixture.name, judgement, legacy: legacy.metrics, agentic: agentic.metrics };
}

main().catch((err) => {
  console.error('[eval] failed:', err);
  process.exit(1);
});
