/**
 * Throwaway sweep — does the v10 confidence rubric calibrate better than v9? (dev only)
 *
 * Runs each labelled fixture through VisionParseService on the PRIMARY model (Qwen) twice
 * per arm: arm v9c (the rubric reverted to the old one-liner + no item_count) and arm v10c
 * (current). Scores accuracy against truth and, crucially, measures CALIBRATION: the gap
 * between mean confidence on objectively-correct parses and on incorrect ones. A rubric that
 * "works" widens that gap (high conf when right, low when wrong). Nothing persisted.
 *
 *   cd Source/backend && npm run eval:prompt-version
 */
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../config/local.env') });

import { BedrockConverseAdapter } from '@infrastructure/adapters/ai/BedrockConverseAdapter';
import { SsmModelRegistryAdapter } from '@infrastructure/adapters/ai/SsmModelRegistryAdapter';
import { VisionParseService } from '@core/services/ingestion/VisionParseService';
import { composeCountryVisionPrompt } from '../prompts/visionParseByCountry';
import { isUnreadableVerdict, isArithmeticConsistent, type ParsedReceipt } from '@core/domain/ingestion';
import type { BedrockImage } from '@core/ports/ai/IBedrockConverse';

const FIXTURES_DIR = path.resolve(__dirname, '../../../../invoices/fixtures/evaluation-set');
const ESTANCIA = '/private/tmp/claude-501/-Users-antonioreuter-repositories-projects-wobblio/ceed2672-36a2-436a-948c-014ffb631611/scratchpad/estancia.jpg';
const IMAGE_FORMATS: Record<string, BedrockImage['format']> = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp' };
const REPS = 2;

interface Truth { merchant?: string; total?: number; currency?: string; country?: string; }

// Reconstruct v9c from the current v10c template by reverting the three known v10 edits. Throws
// if any target is missing — so the sweep can never silently compare v10 against itself.
function toV9(v10: string): string {
  const rubric = v10.match(/- parse_confidence is your 0\.\.1 self-estimate[\s\S]*?serious error\./);
  const itemCount = v10.match(/\n\n<item_count>[\s\S]*?<\/item_count>/);
  if (!rubric || !itemCount) throw new Error('v10 markers not found — cannot derive v9');
  let out = v10.replace(rubric[0], '- parse_confidence is your own 0..1 confidence that the whole extraction is faithful.');
  out = out.replace(itemCount[0], '');
  out = out.replace('\n  "stated_item_count": 12,', '');
  out = out.replace('\nstated_item_count is optional — include it only when a total item count is printed (see <item_count>).', '');
  if (out === v10) throw new Error('v9 derivation was a no-op');
  return out;
}

const v10cFor = (country: string) => composeCountryVisionPrompt(country);
const v9cFor = (country: string) => {
  const c = composeCountryVisionPrompt(country);
  return { template: toV9(c.template), version: c.version.replace('v10c', 'v9c') };
};

interface Run { passCount: number; correct: boolean; confidence: number; statedItemCount?: number; unreadable: boolean; }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const merchantOk = (p: string, t?: string) => !!t && (norm(p).includes(norm(t)) || norm(t).includes(norm(p)));

function score(r: ParsedReceipt, t: Truth): Run {
  const totalOk = t.total != null && Math.abs(r.total - t.total) <= 0.01;
  const reconciled = isArithmeticConsistent(r);
  const passCount = [merchantOk(r.merchantRaw, t.merchant), t.currency ? r.currency === t.currency : false, totalOk, reconciled].filter(Boolean).length;
  return { passCount, correct: totalOk && reconciled, confidence: r.parseConfidence, statedItemCount: r.statedItemCount, unreadable: false };
}

async function runArm(parser: VisionParseService, image: BedrockImage, country: string, truth: Truth): Promise<Run> {
  const result = await parser.parse(image, { countryCode: country, processedDate: new Date().toISOString().slice(0, 10) });
  if (isUnreadableVerdict(result)) return { passCount: 0, correct: false, confidence: 0, unreadable: true };
  return score(result, truth);
}

interface Fixture { name: string; image: BedrockImage; country: string; truth: Truth; }

function loadFixtures(): Fixture[] {
  const out: Fixture[] = [];
  const estanciaOnly = process.env.ESTANCIA_ONLY === '1';
  for (const file of estanciaOnly ? [] : fs.readdirSync(FIXTURES_DIR)) {
    const fmt = IMAGE_FORMATS[path.extname(file).slice(1).toLowerCase()];
    if (!fmt) continue;
    const name = path.basename(file, path.extname(file));
    const truthPath = path.join(FIXTURES_DIR, `${name}.truth.json`);
    if (!fs.existsSync(truthPath)) continue;
    const truth = JSON.parse(fs.readFileSync(truthPath, 'utf8')) as Truth;
    out.push({ name, image: { format: fmt, bytes: fs.readFileSync(path.join(FIXTURES_DIR, file)) }, country: truth.country ?? 'NL', truth });
  }
  if (fs.existsSync(ESTANCIA)) {
    out.push({ name: 'estancia', image: { format: 'jpeg', bytes: fs.readFileSync(ESTANCIA) }, country: 'BR', truth: { merchant: 'Estancia', total: 848.61, currency: 'BRL', country: 'BR' } });
  }
  return out;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

async function main(): Promise<void> {
  const region = process.env.AWS_REGION ?? 'eu-west-1';
  const model = process.env.MODEL_VISION_PARSER ?? (await new SsmModelRegistryAdapter(region).getModelId('vision_parser'));
  const converse = new BedrockConverseAdapter(region);
  const fixtures = loadFixtures();
  console.log(`[eval] v9c vs v10c · model ${model} · ${fixtures.length} fixtures × ${REPS} reps\n`);

  const arms = { v9c: [] as Run[], v10c: [] as Run[] };
  for (const fx of fixtures) {
    const v9 = new VisionParseService(converse, model, () => v9cFor(fx.country));
    const v10 = new VisionParseService(converse, model, () => v10cFor(fx.country));
    for (let rep = 0; rep < REPS; rep++) {
      const a = await runArm(v9, fx.image, fx.country, fx.truth);
      const b = await runArm(v10, fx.image, fx.country, fx.truth);
      arms.v9c.push(a);
      arms.v10c.push(b);
      console.log(`${fx.name}#${rep}  v9c: pass ${a.passCount}/4 conf ${a.confidence.toFixed(2)} ${a.correct ? 'CORRECT' : 'wrong'} cnt=${a.statedItemCount ?? '—'}   ·   v10c: pass ${b.passCount}/4 conf ${b.confidence.toFixed(2)} ${b.correct ? 'CORRECT' : 'wrong'} cnt=${b.statedItemCount ?? '—'}`);
    }
  }

  console.log('\n════ calibration (confidence gap: correct − wrong; larger = better) ════');
  for (const [name, runs] of Object.entries(arms)) {
    const acc = mean(runs.map((r) => r.passCount)) / 4;
    const confCorrect = mean(runs.filter((r) => r.correct).map((r) => r.confidence));
    const confWrong = mean(runs.filter((r) => !r.correct).map((r) => r.confidence));
    const gap = confCorrect - confWrong;
    console.log(`  ${name}: mean-acc ${(acc * 100).toFixed(0)}%  conf|correct ${confCorrect.toFixed(2)}  conf|wrong ${confWrong.toFixed(2)}  gap ${isNaN(gap) ? 'n/a' : gap.toFixed(2)}  statedItemCount emitted ${runs.filter((r) => r.statedItemCount != null).length}/${runs.length}`);
  }
}

main().catch((err) => { console.error('[eval] failed:', err); process.exit(1); });
