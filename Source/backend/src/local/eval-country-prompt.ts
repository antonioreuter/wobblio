/**
 * Offline A/B evaluation — country-specific vision prompt (STUDY / detached, dev only).
 *
 * Runs each labelled fixture through VisionParseService TWICE, changing only the system
 * prompt, and scores both arms against the fixture's ground-truth JSON:
 *   • control   = the production monolith  (visionParse.ts, v9)
 *   • candidate = base skeleton + the country pack for the fixture's country
 * The single variable is the prompt, so any score delta is attributable to the pack.
 * Nothing is persisted and the production path is untouched — this only reads fixtures
 * and calls Bedrock. A country with no pack resolves to DEFAULT_PACK, exercising the
 * fallback the study is meant to prove.
 *
 * Requires the dev AWS profile for Bedrock (STAGE=local pins the regional endpoint).
 * Usage:
 *   cd Source/backend
 *   npm run eval:country-prompt                       # all fixtures, country from truth/NL
 *   npm run eval:country-prompt -- --country=BR        # force candidate country (→ default pack)
 *   npm run eval:country-prompt -- --only=jumbo_1      # a single fixture
 */
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../config/local.env') });

import { BedrockConverseAdapter } from '@infrastructure/adapters/ai/BedrockConverseAdapter';
import { SsmModelRegistryAdapter } from '@infrastructure/adapters/ai/SsmModelRegistryAdapter';
import { VisionParseService } from '@core/services/ingestion/VisionParseService';
import { composeCountryVisionPrompt } from '../prompts/visionParseByCountry';
import { VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION } from '../prompts/visionParse';
import { isUnreadableVerdict, isArithmeticConsistent, type ParsedReceipt } from '@core/domain/ingestion';
import { estimateCostUsd } from '@core/domain/aiSpend';
import type {
  BedrockConverseRequest,
  BedrockConverseResult,
  BedrockImage,
  IBedrockConverse,
} from '@core/ports/ai/IBedrockConverse';

const FIXTURES_DIR = path.resolve(__dirname, '../../../../invoices/fixtures/evaluation-set');
const IMAGE_FORMATS: Record<string, BedrockImage['format']> = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp' };

interface Truth {
  merchant?: string;
  transactionDate?: string;
  currency?: string;
  total?: number;
  country?: string; // optional — the receipt's country; falls back to CLI/NL
}

interface Scored {
  merchantOk: boolean;
  dateOk: boolean;
  currencyOk: boolean;
  totalOk: boolean;
  reconciled: boolean; // Σ line_totals ≈ total (objective, label-independent)
  lineCount: number;
  confidence: number;
  unreadable: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

// Wraps the real Bedrock adapter to sum tokens across the (possibly retried) calls of
// one parse() so we can price each arm. Reset between arms.
class TokenCapturingConverse implements IBedrockConverse {
  inputTokens = 0;
  outputTokens = 0;
  constructor(private readonly inner: IBedrockConverse) {}
  reset(): void {
    this.inputTokens = 0;
    this.outputTokens = 0;
  }
  async converse(request: BedrockConverseRequest): Promise<BedrockConverseResult> {
    const result = await this.inner.converse(request);
    this.inputTokens += result.inputTokens;
    this.outputTokens += result.outputTokens;
    return result;
  }
}

const normalizeMerchant = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

function merchantMatches(parsed: string, truth: string | undefined): boolean {
  if (!truth) return false;
  const a = normalizeMerchant(parsed);
  const b = normalizeMerchant(truth);
  return a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));
}

function scoreReceipt(
  receipt: ParsedReceipt,
  truth: Truth,
  meter: TokenCapturingConverse,
  latencyMs: number,
): Scored {
  return {
    merchantOk: merchantMatches(receipt.merchantRaw, truth.merchant),
    dateOk: truth.transactionDate ? receipt.transactionDate === truth.transactionDate : false,
    currencyOk: truth.currency ? receipt.currency === truth.currency : false,
    totalOk: truth.total != null ? Math.abs(receipt.total - truth.total) <= 0.01 : false,
    reconciled: isArithmeticConsistent(receipt),
    lineCount: receipt.lines.length,
    confidence: receipt.parseConfidence,
    unreadable: null,
    ...tokenScore(meter, latencyMs),
  };
}

function tokenScore(meter: TokenCapturingConverse, latencyMs: number): Pick<Scored, 'inputTokens' | 'outputTokens' | 'costUsd' | 'latencyMs'> {
  return {
    inputTokens: meter.inputTokens,
    outputTokens: meter.outputTokens,
    costUsd: estimateCostUsd([{ stage: 'VISION_PARSE', inputTokens: meter.inputTokens, outputTokens: meter.outputTokens }]),
    latencyMs,
  };
}

async function runArm(
  parser: VisionParseService,
  meter: TokenCapturingConverse,
  attachment: BedrockImage,
  countryCode: string,
  truth: Truth,
): Promise<Scored> {
  meter.reset();
  const startedAt = Date.now();
  const result = await parser.parse(attachment, { countryCode, processedDate: new Date().toISOString().slice(0, 10) });
  const latencyMs = Date.now() - startedAt;
  if (isUnreadableVerdict(result)) {
    return {
      merchantOk: false, dateOk: false, currencyOk: false, totalOk: false, reconciled: false,
      lineCount: 0, confidence: 0, unreadable: result.reason, ...tokenScore(meter, latencyMs),
    };
  }
  return scoreReceipt(result, truth, meter, latencyMs);
}

interface Fixture {
  name: string;
  imagePath: string;
  format: BedrockImage['format'];
  truth: Truth;
}

function loadFixtures(only: string | undefined): Fixture[] {
  const files = fs.readdirSync(FIXTURES_DIR);
  const fixtures: Fixture[] = [];
  for (const file of files) {
    const ext = path.extname(file).slice(1).toLowerCase();
    const format = IMAGE_FORMATS[ext];
    if (!format) continue;
    const name = path.basename(file, path.extname(file));
    if (only && name !== only) continue;
    const truthPath = path.join(FIXTURES_DIR, `${name}.truth.json`);
    if (!fs.existsSync(truthPath)) {
      console.warn(`[eval] skipping ${file} — no ${name}.truth.json`);
      continue;
    }
    fixtures.push({ name, imagePath: path.join(FIXTURES_DIR, file), format, truth: JSON.parse(fs.readFileSync(truthPath, 'utf8')) });
  }
  return fixtures;
}

const flags = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

function checks(s: Scored): string {
  if (s.unreadable) return `UNREADABLE(${s.unreadable})`;
  const mark = (ok: boolean): string => (ok ? '✓' : '✗');
  return `merchant ${mark(s.merchantOk)}  date ${mark(s.dateOk)}  currency ${mark(s.currencyOk)}  total ${mark(s.totalOk)}  Σ ${mark(s.reconciled)}  lines ${s.lineCount}  conf ${s.confidence.toFixed(2)}`;
}

const passCount = (s: Scored): number => [s.merchantOk, s.dateOk, s.currencyOk, s.totalOk, s.reconciled].filter(Boolean).length;

async function main(): Promise<void> {
  const only = flags('only');
  const forcedCountry = flags('country');
  const region = process.env.AWS_REGION ?? 'eu-west-1';
  const visionModelId = process.env.MODEL_VISION_PARSER ?? (await new SsmModelRegistryAdapter(region).getModelId('vision_parser'));

  const meter = new TokenCapturingConverse(new BedrockConverseAdapter(region));
  // Control always uses v9 regardless of country; candidate composes per the fixture's country.
  const control = new VisionParseService(meter, visionModelId, () => ({ template: VISION_PARSE_PROMPT, version: VISION_PARSE_PROMPT_VERSION }));

  const fixtures = loadFixtures(only);
  if (fixtures.length === 0) {
    console.error(`[eval] no fixtures found in ${FIXTURES_DIR}${only ? ` matching "${only}"` : ''}`);
    process.exit(1);
  }

  console.log(`[eval] country-prompt A/B · model ${visionModelId} · ${fixtures.length} fixture(s)\n`);
  const totals = { control: 0, candidate: 0, controlCost: 0, candidateCost: 0 };

  for (const fx of fixtures) {
    const countryCode = forcedCountry ?? fx.truth.country ?? 'NL';
    const composed = composeCountryVisionPrompt(countryCode);
    const candidate = new VisionParseService(meter, visionModelId, composeCountryVisionPrompt);
    const attachment: BedrockImage = { format: fx.format, bytes: fs.readFileSync(fx.imagePath) };

    const controlScore = await runArm(control, meter, attachment, countryCode, fx.truth);
    const candidateScore = await runArm(candidate, meter, attachment, countryCode, fx.truth);

    totals.control += passCount(controlScore);
    totals.candidate += passCount(candidateScore);
    totals.controlCost += controlScore.costUsd;
    totals.candidateCost += candidateScore.costUsd;

    console.log(`── ${fx.name}  (country ${countryCode} → pack ${composed.pack.code})`);
    console.log(`   control  (${VISION_PARSE_PROMPT_VERSION})   ${checks(controlScore)}`);
    console.log(`   candidate (${composed.version})  ${checks(candidateScore)}`);
    console.log(
      `   tokens control ${controlScore.inputTokens}/${controlScore.outputTokens} $${controlScore.costUsd.toFixed(5)} ${controlScore.latencyMs}ms` +
        ` · candidate ${candidateScore.inputTokens}/${candidateScore.outputTokens} $${candidateScore.costUsd.toFixed(5)} ${candidateScore.latencyMs}ms\n`,
    );
  }

  const max = fixtures.length * 5;
  console.log('════ summary (checks passed / possible) ════');
  console.log(`  control    ${totals.control}/${max}   est. $${totals.controlCost.toFixed(5)}`);
  console.log(`  candidate  ${totals.candidate}/${max}   est. $${totals.candidateCost.toFixed(5)}`);
  const delta = totals.candidate - totals.control;
  console.log(`  Δ candidate−control: ${delta >= 0 ? '+' : ''}${delta} checks`);
}

main().catch((err) => {
  console.error('[eval] failed:', err);
  process.exit(1);
});
