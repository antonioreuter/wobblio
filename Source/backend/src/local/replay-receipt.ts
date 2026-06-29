/**
 * Local single-receipt ingestion replay — dev only.
 *
 * Pushes ONE receipt image through the REAL ingestion worker against the local stack
 * (LocalStack S3 + local Postgres + the dev Bedrock models), then prints the outcome — so
 * you can validate a parse/ingestion fix end-to-end on a single receipt without the webapp.
 * Uses the exact production worker code path (the same handler the local poller invokes).
 *
 * Requires the local stack up (LocalStack + Postgres) and the dev AWS profile for Bedrock.
 * Usage:
 *   cd Source/backend
 *   npm run replay -- ../../invoices/your-receipt.jpg
 *   # optional 2nd arg: a label for logging, e.g. "continuation-line fix"
 */
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../config/local.env') });

import { Pool } from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { SQSEvent, Context } from 'aws-lambda';
import { handler as ingestionWorker } from '@handlers/ingestion-worker';

const EXT_TO_TYPE: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
};

// Owner connection (RLS-bypassed) to seed/read directly, mirroring the integration tests.
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

const TEST_EMAIL = 'replay@local.test';

async function ensureTenant(pool: Pool): Promise<string> {
  await pool.query(
    `INSERT INTO app_user (cognito_sub, email, status) VALUES ($1, $2, 'ACTIVE')
     ON CONFLICT (cognito_sub) DO NOTHING`,
    ['sub-replay-local', TEST_EMAIL],
  );
  const r = await pool.query<{ id: string }>(`SELECT id FROM app_user WHERE cognito_sub = $1`, ['sub-replay-local']);
  return r.rows[0].id;
}

async function main(): Promise<void> {
  const imagePath = process.argv[2];
  const label = process.argv[3];
  if (!imagePath) {
    console.error('usage: npm run replay -- <image-path> [label]');
    process.exit(1);
  }

  const bytes = fs.readFileSync(path.resolve(imagePath));
  const ext = path.extname(imagePath).slice(1).toLowerCase();
  const contentType = EXT_TO_TYPE[ext] ?? 'image/jpeg';
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');

  const pool = ownerPool();
  const tenant = await ensureTenant(pool);
  const s3Key = `receipts/${tenant}/${sha}.${ext}`;
  const invoiceId = crypto.randomUUID();

  // Fresh replay: clear this tenant's prior invoices (lines first — invoice_line FK is NO
  // ACTION, not CASCADE) + the content-addressed ledger claim, so the same image re-runs
  // (otherwise the worker short-circuits as a duplicate delivery).
  await pool.query(`DELETE FROM invoice_line WHERE invoice_id IN (SELECT id FROM invoice WHERE tenant_id = $1)`, [tenant]);
  await pool.query(`DELETE FROM invoice WHERE tenant_id = $1`, [tenant]);
  await pool.query(`DELETE FROM ingestion_ledger WHERE tenant_id = $1`, [tenant]);

  const s3 = new S3Client({
    region: process.env.AWS_REGION ?? 'eu-west-1',
    endpoint: process.env.AWS_ENDPOINT_URL_S3 ?? process.env.AWS_ENDPOINT_URL,
    forcePathStyle: true,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
  await s3.send(new PutObjectCommand({ Bucket: process.env.UPLOADS_BUCKET!, Key: s3Key, Body: bytes, ContentType: contentType }));

  await pool.query(
    `INSERT INTO invoice (id, tenant_id, uploaded_by_user_id, image_s3_key, image_sha256, status, quota_pooled)
     VALUES ($1, $2, $2, $3, $4, 'PROCESSING', false)`,
    [invoiceId, tenant, s3Key, sha],
  );

  console.log(`[replay] ${label ? `(${label}) ` : ''}processing ${path.basename(imagePath)} → invoice ${invoiceId} …`);
  // attributes are required: the worker reads SentTimestamp (timing log) + ApproximateReceiveCount
  // (final-delivery quarantine gate); real SQS always supplies them, a synthesized event must too.
  await ingestionWorker(
    {
      Records: [{
        messageId: invoiceId,
        body: JSON.stringify({ invoiceId, tenantId: tenant, s3Key }),
        receiptHandle: 'replay',
        attributes: { SentTimestamp: String(Date.now()), ApproximateReceiveCount: '1' },
      }],
    } as unknown as SQSEvent,
    {} as Context,
  );

  const r = await pool.query(
    `SELECT i.status, i.failure_reason_code, i.system_fault_reason, i.total::text AS total, i.currency,
            m.brand_name AS merchant,
            (SELECT count(*) FROM invoice_line WHERE invoice_id = i.id) AS line_count
     FROM invoice i LEFT JOIN merchant m ON m.id = i.merchant_id WHERE i.id = $1`,
    [invoiceId],
  );
  const lines = await pool.query(
    `SELECT raw_text, quantity::text AS quantity, line_total::text AS line_total
     FROM invoice_line WHERE invoice_id = $1 ORDER BY line_index`,
    [invoiceId],
  );

  console.log('\n[replay] outcome:', JSON.stringify(r.rows[0], null, 2));
  console.log('[replay] lines:');
  for (const l of lines.rows) console.log(`  ${l.quantity} × ${l.raw_text} = ${l.line_total}`);

  const status = r.rows[0]?.status;
  const verdict = status === 'PARSED' ? '✅ PARSED'
    : status === 'NEEDS_REVIEW' ? '⚠️  NEEDS_REVIEW'
    : r.rows[0]?.system_fault_reason ? `❌ QUARANTINED (system fault: ${r.rows[0].system_fault_reason})`
    : `❌ ${status}${r.rows[0]?.failure_reason_code ? ` (${r.rows[0].failure_reason_code})` : ''}`;
  console.log(`\n[replay] ${verdict}`);

  await pool.end();
}

main().catch((err) => {
  console.error('[replay] failed:', err);
  process.exit(1);
});
