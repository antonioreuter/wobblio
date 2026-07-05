/**
 * Vision-cost benchmark — dev only (detached study, sub-spec 01).
 *
 * Answers: on the vision-parse stage, is Sonnet 4.6 + prompt cache cost-competitive with
 * Qwen3-VL (no cache), and does it match/beat Qwen's accuracy (esp. jumbo_2)?
 *
 * Two arms over every receipt, vision-parse only (no S3/Postgres/pipeline):
 *   A (control)   — SSM vision_parser (Qwen), plain BedrockConverseAdapter, no cache
 *   B (treatment) — Sonnet 4.6, CachingBedrockConverseAdapter, prompt cache ON
 *
 * Corpus: invoices/fixtures/benchmark-corpus/ (cost/behaviour only) + the curated
 * invoices/fixtures/evaluation-set/ fixtures (additionally judged vs .truth.json).
 * Cost is priced with correct cache weights (cacheRead ×0.1, cacheWrite ×1.25). Real dev
 * Bedrock — costs tokens.
 *
 *   cd Source/backend
 *   npm run corpus:pull          # once, to populate the corpus
 *   npm run benchmark:vision-cost
 */
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../config/local.env') });

import { SsmModelRegistryAdapter } from '@infrastructure/adapters/ai/SsmModelRegistryAdapter';
import { BedrockConverseAdapter } from '@infrastructure/adapters/ai/BedrockConverseAdapter';
import { CachingBedrockConverseAdapter } from '@infrastructure/adapters/ai/CachingBedrockConverseAdapter';
import { VisionParseService } from '@core/services/ingestion/VisionParseService';
import { judgePipelines } from './evaluation/judge';
import { isUnreadableVerdict, type ParsedReceipt } from '@core/domain/ingestion';
import type { IBedrockConverse, BedrockConverseRequest, BedrockConverseResult, BedrockImage, BedrockDocument } from '@core/ports/ai/IBedrockConverse';
import type { ExtractionResult } from '@core/services/ingestion/InvoiceFinalizer';
import type { PipelineScores } from '@core/domain/pipelineJudgeSchema';
import { VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION } from '../prompts/visionParse';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';
const CORPUS_DIR = path.resolve(__dirname, '../../../../invoices/fixtures/benchmark-corpus');
const EVAL_DIR = path.resolve(__dirname, '../../../../invoices/fixtures/evaluation-set');
const COUNTRY = 'NL';
const PROCESSED_DATE = new Date().toISOString().slice(0, 10);

// USD per 1k tokens (input, output) — same class-based estimates as core/domain/aiSpend.ts.
const QWEN_RATE = { input: 0.0008, output: 0.0008 };
const SONNET_RATE = { input: 0.003, output: 0.015 };

interface CallUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheWriteInputTokens: number;
  durationMs: number;
}

// Captures the token usage of every converse call so a single parse() (which may retry once)
// is summed into one per-receipt figure. drain() returns the sum and resets.
class RecordingConverse implements IBedrockConverse {
  private calls: CallUsage[] = [];
  constructor(private readonly inner: IBedrockConverse) {}

  async converse(request: BedrockConverseRequest): Promise<BedrockConverseResult> {
    const r = await this.inner.converse(request);
    this.calls.push({
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheReadInputTokens: r.cacheReadInputTokens ?? 0,
      cacheWriteInputTokens: r.cacheWriteInputTokens ?? 0,
      durationMs: r.durationMs,
    });
    return r;
  }

  drain(): CallUsage {
    const sum = this.calls.reduce<CallUsage>(
      (a, c) => ({
        inputTokens: a.inputTokens + c.inputTokens,
        outputTokens: a.outputTokens + c.outputTokens,
        cacheReadInputTokens: a.cacheReadInputTokens + c.cacheReadInputTokens,
        cacheWriteInputTokens: a.cacheWriteInputTokens + c.cacheWriteInputTokens,
        durationMs: a.durationMs + c.durationMs,
      }),
      { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheWriteInputTokens: 0, durationMs: 0 },
    );
    this.calls = [];
    return sum;
  }
}

interface Arm {
  label: string;
  service: VisionParseService;
  recorder: RecordingConverse;
  rate: { input: number; output: number };
}

interface ReceiptRun {
  outcome: 'parsed' | 'unreadable' | 'error';
  usage: CallUsage;
  costUsd: number;
  receipt?: ParsedReceipt;
}

interface Fixture {
  name: string;
  attachment: BedrockImage | BedrockDocument;
  truth?: unknown;
}

function priceCall(u: CallUsage, rate: { input: number; output: number }): number {
  return (
    (u.inputTokens / 1000) * rate.input +
    (u.outputTokens / 1000) * rate.output +
    (u.cacheReadInputTokens / 1000) * rate.input * 0.1 +
    (u.cacheWriteInputTokens / 1000) * rate.input * 1.25
  );
}

function loadAttachment(file: string, dir: string): BedrockImage | BedrockDocument {
  const bytes = new Uint8Array(fs.readFileSync(path.join(dir, file)));
  const ext = path.extname(file).slice(1).toLowerCase();
  if (ext === 'pdf') return { format: 'pdf', bytes, name: file.replace(/[^a-zA-Z0-9 -]/g, '-') };
  return { format: ext === 'png' ? 'png' : 'jpeg', bytes };
}

function loadCorpus(): Fixture[] {
  if (!fs.existsSync(CORPUS_DIR)) return [];
  return fs
    .readdirSync(CORPUS_DIR)
    .filter((f) => /\.(jpe?g|png|pdf)$/i.test(f))
    .map((f) => ({ name: f, attachment: loadAttachment(f, CORPUS_DIR) }));
}

function loadCurated(): Fixture[] {
  if (!fs.existsSync(EVAL_DIR)) return [];
  return fs
    .readdirSync(EVAL_DIR)
    .filter((f) => /\.(jpe?g|png|pdf)$/i.test(f))
    .map((f) => {
      const truthPath = path.join(EVAL_DIR, `${f.replace(/\.[^.]+$/, '')}.truth.json`);
      const truth = fs.existsSync(truthPath) ? JSON.parse(fs.readFileSync(truthPath, 'utf-8')) : undefined;
      return { name: `curated:${f}`, attachment: loadAttachment(f, EVAL_DIR), truth };
    });
}

async function runArm(arm: Arm, fx: Fixture): Promise<ReceiptRun> {
  arm.recorder.drain(); // clear any residue
  try {
    const parsed = await arm.service.parse(fx.attachment, { countryCode: COUNTRY, processedDate: PROCESSED_DATE });
    const usage = arm.recorder.drain();
    const costUsd = priceCall(usage, arm.rate);
    if (isUnreadableVerdict(parsed)) return { outcome: 'unreadable', usage, costUsd };
    return { outcome: 'parsed', usage, costUsd, receipt: parsed };
  } catch (err) {
    console.warn(`  [${arm.label}] ${fx.name} error: ${err instanceof Error ? err.message : String(err)}`);
    return { outcome: 'error', usage: arm.recorder.drain(), costUsd: 0 };
  }
}

// Minimal ExtractionResult wrapper so the existing judge can grade a raw vision parse. The
// judge's projection (toJudgeOutput) reads only receipt/merchant/normalized/categoryId/tags —
// classification/tag stages are downstream and out of this study's scope.
function asExtraction(receipt: ParsedReceipt): ExtractionResult {
  return {
    receipt,
    merchant: { merchantId: null, brandName: receipt.merchantRaw, provisional: false, confidence: receipt.parseConfidence },
    normalized: [],
    categoryId: null,
    tags: [],
  } as unknown as ExtractionResult;
}

interface ArmTotals {
  receipts: number;
  parsed: number;
  unreadable: number;
  errors: number;
  totalCost: number;
  totalLatencyMs: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cacheHits: number;
  cacheWrites: number;
}

function emptyTotals(): ArmTotals {
  return { receipts: 0, parsed: 0, unreadable: 0, errors: 0, totalCost: 0, totalLatencyMs: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cacheHits: 0, cacheWrites: 0 };
}

function accumulate(t: ArmTotals, run: ReceiptRun): void {
  t.receipts++;
  t[run.outcome === 'parsed' ? 'parsed' : run.outcome === 'unreadable' ? 'unreadable' : 'errors']++;
  t.totalCost += run.costUsd;
  t.totalLatencyMs += run.usage.durationMs;
  t.cacheReadTokens += run.usage.cacheReadInputTokens;
  t.cacheWriteTokens += run.usage.cacheWriteInputTokens;
  if (run.usage.cacheReadInputTokens > 0) t.cacheHits++;
  if (run.usage.cacheWriteInputTokens > 0) t.cacheWrites++;
}

function usd(n: number): string {
  return `$${n.toFixed(5)}`;
}

function renderCostTable(labels: [string, string], a: ArmTotals, b: ArmTotals): string {
  const rows: Array<[string, string, string]> = [
    ['receipts', String(a.receipts), String(b.receipts)],
    ['parsed / unreadable / error', `${a.parsed}/${a.unreadable}/${a.errors}`, `${b.parsed}/${b.unreadable}/${b.errors}`],
    ['total cost', usd(a.totalCost), usd(b.totalCost)],
    ['avg cost / receipt', usd(a.totalCost / Math.max(a.receipts, 1)), usd(b.totalCost / Math.max(b.receipts, 1))],
    ['avg latency (ms)', String(Math.round(a.totalLatencyMs / Math.max(a.receipts, 1))), String(Math.round(b.totalLatencyMs / Math.max(b.receipts, 1)))],
    ['cache hits (receipts)', String(a.cacheHits), String(b.cacheHits)],
    ['cache writes (receipts)', String(a.cacheWrites), String(b.cacheWrites)],
    ['cacheRead / cacheWrite tokens', `${a.cacheReadTokens}/${a.cacheWriteTokens}`, `${b.cacheReadTokens}/${b.cacheWriteTokens}`],
  ];
  const w0 = Math.max(...rows.map((r) => r[0].length), 'metric'.length);
  const w1 = Math.max(...rows.map((r) => r[1].length), labels[0].length);
  const w2 = Math.max(...rows.map((r) => r[2].length), labels[1].length);
  const line = (c0: string, c1: string, c2: string) => `${c0.padEnd(w0)} | ${c1.padStart(w1)} | ${c2.padStart(w2)}`;
  const out = [line('metric', labels[0], labels[1]), line('-'.repeat(w0), '-'.repeat(w1), '-'.repeat(w2))];
  for (const r of rows) out.push(line(r[0], r[1], r[2]));
  return out.join('\n');
}

function renderScores(label: string, s: PipelineScores): string {
  return `${label}: extraction ${s.extractionAccuracy.toFixed(2)}, line-items ${s.lineItemCompleteness.toFixed(2)}`;
}

async function main(): Promise<void> {
  const fixtures = [...loadCorpus(), ...loadCurated()];
  if (fixtures.length === 0) {
    console.error(`[bench] no fixtures. Run "npm run corpus:pull" first (looked in ${CORPUS_DIR} and ${EVAL_DIR}).`);
    process.exit(1);
  }

  // Model IDs: env overrides first (so the study runs against real Bedrock without depending on
  // a seeded local SSM), else the SSM registry. Sonnet 4.6 lives under the vision_fallback/pdf_parser
  // roles in dev.
  const registry = new SsmModelRegistryAdapter(REGION);
  const qwenId = process.env.BENCH_QWEN_MODEL_ID ?? (await registry.getModelId('vision_parser'));
  const sonnetId =
    process.env.BENCH_SONNET_MODEL_ID ??
    (await registry.getModelIdOptional('vision_fallback')) ??
    (await registry.getModelId('pdf_parser'));
  const insightId = process.env.BENCH_INSIGHT_MODEL_ID ?? (await registry.getModelId('insight'));

  const plainConverse = new BedrockConverseAdapter(REGION);
  const qwenRecorder = new RecordingConverse(plainConverse);
  const sonnetRecorder = new RecordingConverse(new CachingBedrockConverseAdapter(REGION));

  const armA: Arm = {
    label: `Qwen (${qwenId})`,
    service: new VisionParseService(qwenRecorder, qwenId, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION),
    recorder: qwenRecorder,
    rate: QWEN_RATE,
  };
  const armB: Arm = {
    label: `Sonnet+cache (${sonnetId})`,
    service: new VisionParseService(sonnetRecorder, sonnetId, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION, 'VISION_PARSE_FALLBACK'),
    recorder: sonnetRecorder,
    rate: SONNET_RATE,
  };

  console.log(`[bench] ${fixtures.length} receipts · A=${armA.label} · B=${armB.label}\n`);

  const totalsA = emptyTotals();
  const totalsB = emptyTotals();

  for (const fx of fixtures) {
    const a = await runArm(armA, fx);
    const b = await runArm(armB, fx);
    accumulate(totalsA, a);
    accumulate(totalsB, b);
    console.log(`[bench] ${fx.name}: A ${a.outcome} ${usd(a.costUsd)} · B ${b.outcome} ${usd(b.costUsd)} (read ${b.usage.cacheReadInputTokens}/write ${b.usage.cacheWriteInputTokens})`);

    if (fx.truth && a.receipt && b.receipt) {
      try {
        const judgement = await judgePipelines(plainConverse, insightId, fx.truth, asExtraction(a.receipt), asExtraction(b.receipt));
        console.log(`         judge → ${renderScores('Qwen', judgement.legacyScores)} | ${renderScores('Sonnet', judgement.agenticScores)}`);
        console.log(`         ${judgement.analysis}`);
      } catch (err) {
        console.warn(`         judge skipped: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  console.log('\n=== Vision cost bake-off ===');
  console.log(renderCostTable([armA.label, armB.label], totalsA, totalsB));
  console.log(
    '\nRead the amortized "avg cost / receipt" for B as the steady-state answer: the one-time cache' +
      '\nwrite(s) are spread across the batch, and cache hits are billed at 0.1×. If B ≈ A, Sonnet+cache' +
      "\nis cost-competitive with Qwen — with Sonnet's accuracy (see curated judge scores above).",
  );
}

main().catch((err) => {
  console.error('[bench] failed:', err);
  process.exit(1);
});
