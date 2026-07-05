/**
 * Benchmark corpus builder — dev only.
 *
 * Assembles a local, GITIGNORED corpus of receipts for the vision-cost benchmark
 * (Sonnet 4.6 + cache vs Qwen) at invoices/fixtures/benchmark-corpus/:
 *   1. copies every local invoices/*.{jpeg,jpg,png,pdf}
 *   2. samples up to --limit objects from the DEV uploads bucket under receipts/
 *
 * Real dev AWS (NOT LocalStack). Run with a dev AWS profile that can read the bucket:
 *   cd Source/backend
 *   AWS_PROFILE=<dev> AWS_REGION=eu-west-1 npm run corpus:pull -- --limit 100
 *
 * PROD SAFETY: the bucket is fixed to wobblio-uploads-dev and any name containing "prod"
 * is refused. GDPR is waived for this dev-only study (per owner) — the corpus is never committed.
 */
import path from 'node:path';
import fs from 'node:fs';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

const DEV_BUCKET = 'wobblio-uploads-dev';
const REGION = process.env.AWS_REGION ?? 'eu-west-1';
const PREFIX = 'receipts/';
const LOCAL_INVOICES = path.resolve(__dirname, '../../../../invoices');
const CORPUS_DIR = path.resolve(__dirname, '../../../../invoices/fixtures/benchmark-corpus');
const IMAGE_RE = /\.(jpe?g|png|pdf)$/i;
const LIST_CAP = 1000; // collect up to this many keys, then random-sample --limit from them

function refuseProd(bucket: string): void {
  if (/prod/i.test(bucket)) throw new Error(`refusing to touch a prod-looking bucket: ${bucket}`);
}

function argLimit(): number {
  const i = process.argv.indexOf('--limit');
  const n = i >= 0 ? Number(process.argv[i + 1]) : 100;
  return Number.isFinite(n) && n > 0 ? n : 100;
}

function copyLocalInvoices(): number {
  if (!fs.existsSync(LOCAL_INVOICES)) return 0;
  const files = fs.readdirSync(LOCAL_INVOICES).filter((f) => IMAGE_RE.test(f));
  for (const f of files) {
    fs.copyFileSync(path.join(LOCAL_INVOICES, f), path.join(CORPUS_DIR, `local_${f}`));
  }
  return files.length;
}

async function listKeys(s3: S3Client): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: DEV_BUCKET, Prefix: PREFIX, ContinuationToken: token }));
    for (const o of page.Contents ?? []) if (o.Key && IMAGE_RE.test(o.Key)) keys.push(o.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token && keys.length < LIST_CAP);
  return keys;
}

function sample<T>(items: T[], n: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

async function download(s3: S3Client, key: string): Promise<void> {
  const res = await s3.send(new GetObjectCommand({ Bucket: DEV_BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  // receipts/<tenant>/<sha>.<ext> → dev_<sha>.<ext>; sha is unique so no collisions.
  const base = key.split('/').pop()!;
  fs.writeFileSync(path.join(CORPUS_DIR, `dev_${base}`), Buffer.from(bytes));
}

async function main(): Promise<void> {
  refuseProd(DEV_BUCKET);
  fs.mkdirSync(CORPUS_DIR, { recursive: true });

  const localCount = copyLocalInvoices();
  console.log(`[corpus] copied ${localCount} local invoices`);

  const s3 = new S3Client({ region: REGION });
  const allKeys = await listKeys(s3);
  const picked = sample(allKeys, argLimit());
  console.log(`[corpus] found ${allKeys.length} dev objects, downloading ${picked.length} …`);

  let ok = 0;
  for (const key of picked) {
    try {
      await download(s3, key);
      ok++;
    } catch (err) {
      console.warn(`[corpus] skip ${key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`[corpus] done → ${CORPUS_DIR} (${localCount} local + ${ok} dev = ${localCount + ok} receipts)`);
}

main().catch((err) => {
  console.error('[corpus] failed:', err);
  process.exit(1);
});
