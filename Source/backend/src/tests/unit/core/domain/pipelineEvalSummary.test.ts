import { describe, it, expect } from 'vitest';
import {
  summarizePipelineEval,
  renderSummaryTable,
  type FixtureEvaluation,
} from '@core/domain/pipelineEvalSummary';

const scores = (v: number) => ({
  extractionAccuracy: v,
  lineItemCompleteness: v,
  classificationAlignment: v,
  tagRelevance: v,
});

const evaluations: FixtureEvaluation[] = [
  {
    fixture: 'ah_1',
    judgement: { legacyScores: scores(0.8), agenticScores: scores(0.9), analysis: 'a' },
    legacy: { processingMs: 4000, costUsd: 0.01 },
    agentic: { processingMs: 3000, costUsd: 0.02 },
  },
  {
    fixture: 'jumbo_1',
    judgement: { legacyScores: scores(0.6), agenticScores: scores(0.7), analysis: 'b' },
    legacy: { processingMs: 6000, costUsd: 0.03 },
    agentic: { processingMs: 5000, costUsd: 0.04 },
  },
];

describe('summarizePipelineEval', () => {
  it('averages scores, latency, and cost per pipeline', () => {
    const summary = summarizePipelineEval(evaluations);

    expect(summary.count).toBe(2);
    expect(summary.legacy.overall).toBeCloseTo(0.7);
    expect(summary.agentic.overall).toBeCloseTo(0.8);
    expect(summary.legacy.avgLatencyMs).toBe(5000);
    expect(summary.agentic.avgCostUsd).toBeCloseTo(0.03);
  });

  it('handles an empty set without dividing by zero', () => {
    const summary = summarizePipelineEval([]);
    expect(summary.count).toBe(0);
    expect(summary.legacy.overall).toBe(0);
    expect(summary.agentic.avgLatencyMs).toBe(0);
  });
});

describe('renderSummaryTable', () => {
  it('renders both pipelines and all four criteria', () => {
    const table = renderSummaryTable(summarizePipelineEval(evaluations));
    expect(table).toContain('LEGACY');
    expect(table).toContain('STRANDS');
    expect(table).toContain('Overall score');
    expect(table).toContain('Avg cost / invoice');
    expect(table).toContain('Extraction accuracy');
  });
});
