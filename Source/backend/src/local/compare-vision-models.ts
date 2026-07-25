/**
 * Throwaway dev script — Qwen vs Sonnet on ONE receipt image.
 * Runs the production v9 vision prompt through VisionParseService twice, changing ONLY
 * the model id, and prints both parses line-by-line so we can judge which handles a
 * hard (large, faded, weight-priced) receipt better. Nothing persisted.
 *
 *   cd Source/backend
 *   npm run compare-vision -- <image-path>
 */
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../config/local.env') });

import { BedrockConverseAdapter } from '@infrastructure/adapters/ai/BedrockConverseAdapter';
import { VisionParseService } from '@core/services/ingestion/VisionParseService';
import { VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION } from '../prompts/visionParse';
import { isUnreadableVerdict, isArithmeticConsistent, type ParsedReceipt } from '@core/domain/ingestion';
import { estimateCostUsd } from '@core/domain/aiSpend';
import type { BedrockConverseRequest, BedrockConverseResult, BedrockImage, IBedrockConverse } from '@core/ports/ai/IBedrockConverse';

const MODELS: Record<string, string> = {
  qwen: 'qwen.qwen3-vl-235b-a22b',
  sonnet: 'eu.anthropic.claude-sonnet-4-6',
  opus: 'eu.anthropic.claude-opus-4-6-v1',
};
const IMAGE_FORMATS: Record<string, BedrockImage['format']> = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp' };

class Meter implements IBedrockConverse {
  inputTokens = 0;
  outputTokens = 0;
  constructor(private readonly inner: IBedrockConverse) {}
  reset(): void { this.inputTokens = 0; this.outputTokens = 0; }
  async converse(r: BedrockConverseRequest): Promise<BedrockConverseResult> {
    const res = await this.inner.converse(r);
    this.inputTokens += res.inputTokens;
    this.outputTokens += res.outputTokens;
    return res;
  }
}

async function runOne(label: string, modelId: string, meter: Meter, image: BedrockImage): Promise<void> {
  meter.reset();
  const parser = new VisionParseService(meter, modelId, () => ({ template: VISION_PARSE_PROMPT, version: VISION_PARSE_PROMPT_VERSION }));
  const startedAt = Date.now();
  const result = await parser.parse(image, { countryCode: 'BR', processedDate: new Date().toISOString().slice(0, 10) });
  const ms = Date.now() - startedAt;
  const cost = estimateCostUsd([{ stage: 'VISION_PARSE', inputTokens: meter.inputTokens, outputTokens: meter.outputTokens }]);

  console.log(`\n════════ ${label}  (${modelId}) ════════`);
  if (isUnreadableVerdict(result)) {
    console.log(`UNREADABLE: ${result.reason}   ${ms}ms  $${cost.toFixed(5)}`);
    return;
  }
  const r = result as ParsedReceipt;
  const sum = r.lines.reduce((a, l) => a + l.lineTotal, 0);
  console.log(`merchant="${r.merchantRaw}"  date=${r.transactionDate}  currency=${r.currency}  total=${r.total}`);
  const units = r.lines.reduce((a, l) => a + l.quantity, 0);
  console.log(`lines=${r.lines.length}  units=${units}  statedItemCount=${r.statedItemCount ?? '—'}  Σlines=${sum.toFixed(2)}  reconciled=${isArithmeticConsistent(r)}  conf=${r.parseConfidence.toFixed(2)}  ${ms}ms  in/out=${meter.inputTokens}/${meter.outputTokens}  $${cost.toFixed(5)}`);
  let badMath = 0;
  for (const [i, l] of r.lines.entries()) {
    const u = l.unitPrice ?? null;
    const consistent = u == null ? '   ' : (Math.abs(l.quantity * u - l.lineTotal) <= 0.02 ? ' ok' : ' ✗ ');
    if (u != null && Math.abs(l.quantity * u - l.lineTotal) > 0.02) badMath++;
    console.log(`  ${String(i).padStart(2)} qty=${String(l.quantity).padStart(6)} unit=${String(u ?? '').padStart(7)} tot=${String(l.lineTotal).padStart(7)}${consistent} ${l.rawText}`);
  }
  console.log(`  → lines with qty×unit≠total: ${badMath}`);
}

async function main(): Promise<void> {
  const imagePath = process.argv[2];
  if (!imagePath) { console.error('usage: npm run compare-vision -- <image-path>'); process.exit(1); }
  const ext = path.extname(imagePath).slice(1).toLowerCase();
  const format = IMAGE_FORMATS[ext];
  if (!format) { console.error(`unsupported ext: ${ext}`); process.exit(1); }
  const image: BedrockImage = { format, bytes: fs.readFileSync(path.resolve(imagePath)) };

  const meter = new Meter(new BedrockConverseAdapter(process.env.AWS_REGION ?? 'eu-west-1'));
  const only = process.env.ONLY_MODEL;
  if (!only || only === 'qwen') await runOne('QWEN (current prod)', MODELS.qwen, meter, image);
  if (!only || only === 'sonnet') await runOne('SONNET 4-6 (candidate)', MODELS.sonnet, meter, image);
  if (!only || only === 'opus') await runOne('OPUS 4-8 (candidate)', MODELS.opus, meter, image);
}

main().catch((e) => { console.error('failed:', e); process.exit(1); });
