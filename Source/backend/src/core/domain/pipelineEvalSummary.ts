import { JUDGE_CRITERIA, type PipelineJudgement, type PipelineScores } from './pipelineJudgeSchema';

// Per-fixture result feeding the comparative summary (NF-01/07): the judge's two score sets
// plus each pipeline's measured latency and estimated cost for that fixture.
export interface FixtureEvaluation {
  fixture: string;
  judgement: PipelineJudgement;
  legacy: PipelineRunMetrics;
  agentic: PipelineRunMetrics;
}

export interface PipelineRunMetrics {
  processingMs: number;
  costUsd: number;
}

export interface PipelineSummary {
  scores: PipelineScores;
  overall: number; // mean of the four criteria
  avgLatencyMs: number;
  avgCostUsd: number;
}

export interface EvalSummary {
  count: number;
  legacy: PipelineSummary;
  agentic: PipelineSummary;
}

export function summarizePipelineEval(evaluations: FixtureEvaluation[]): EvalSummary {
  return {
    count: evaluations.length,
    legacy: summarize(
      evaluations.map((e) => e.judgement.legacyScores),
      evaluations.map((e) => e.legacy),
    ),
    agentic: summarize(
      evaluations.map((e) => e.judgement.agenticScores),
      evaluations.map((e) => e.agentic),
    ),
  };
}

function summarize(scores: PipelineScores[], metrics: PipelineRunMetrics[]): PipelineSummary {
  const averaged = {} as PipelineScores;
  for (const { key } of JUDGE_CRITERIA) {
    averaged[key] = mean(scores.map((s) => s[key]));
  }
  const overall = mean(JUDGE_CRITERIA.map(({ key }) => averaged[key]));
  return {
    scores: averaged,
    overall,
    avgLatencyMs: mean(metrics.map((m) => m.processingMs)),
    avgCostUsd: mean(metrics.map((m) => m.costUsd)),
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Plain-text comparison table for the CLI. Kept in the domain so it can be unit-tested without
// the script's IO.
export function renderSummaryTable(summary: EvalSummary): string {
  const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
  const ms = (v: number): string => `${Math.round(v)}ms`;
  const usd = (v: number): string => `$${v.toFixed(4)}`;
  const row = (label: string, legacy: string, agentic: string): string =>
    `${label.padEnd(26)} ${legacy.padStart(12)} ${agentic.padStart(12)}`;

  const lines = [
    `Pipeline comparison over ${summary.count} fixture(s)`,
    row('Criterion', 'LEGACY', 'STRANDS'),
    row('─'.repeat(26), '─'.repeat(12), '─'.repeat(12)),
  ];
  for (const { key, label } of JUDGE_CRITERIA) {
    lines.push(row(label, pct(summary.legacy.scores[key]), pct(summary.agentic.scores[key])));
  }
  lines.push(row('Overall score', pct(summary.legacy.overall), pct(summary.agentic.overall)));
  lines.push(row('Avg latency', ms(summary.legacy.avgLatencyMs), ms(summary.agentic.avgLatencyMs)));
  lines.push(row('Avg cost / invoice', usd(summary.legacy.avgCostUsd), usd(summary.agentic.avgCostUsd)));
  return lines.join('\n');
}
