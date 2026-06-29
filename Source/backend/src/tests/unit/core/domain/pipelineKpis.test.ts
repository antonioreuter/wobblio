import { describe, it, expect } from 'vitest';
import { toPipelineKpiRows, PIPELINE_METRICS, type PipelineKpiAggregate } from '@core/domain/pipelineKpis';

const legacy: PipelineKpiAggregate = {
  pipelineType: 'LEGACY',
  invoiceCount: 10,
  avgProcessingMs: 4200,
  avgCostUsd: 0.012,
  needsReviewCount: 3,
  feedbackDown: 1,
  feedbackRated: 4,
};

describe('toPipelineKpiRows', () => {
  it('emits the four metrics per pipeline with a pipeline_type dimension', () => {
    const rows = toPipelineKpiRows('2026-06-30', [legacy]);

    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.metricDate).toBe('2026-06-30');
      expect(row.dimensions).toEqual({ pipeline_type: 'LEGACY' });
    }
    const byMetric = new Map(rows.map((r) => [r.metricName, r.value]));
    expect(byMetric.get(PIPELINE_METRICS.avgProcessingMs)).toBe(4200);
    expect(byMetric.get(PIPELINE_METRICS.costPerInvoice)).toBe(0.012);
    expect(byMetric.get(PIPELINE_METRICS.needsReviewRate)).toBe(0.3);
    expect(byMetric.get(PIPELINE_METRICS.feedbackDownRatio)).toBe(0.25);
  });

  it('guards divide-by-zero: no invoices and no rated feedback report 0, not NaN', () => {
    const empty: PipelineKpiAggregate = {
      pipelineType: 'STRANDS',
      invoiceCount: 0,
      avgProcessingMs: 0,
      avgCostUsd: 0,
      needsReviewCount: 0,
      feedbackDown: 0,
      feedbackRated: 0,
    };

    const rows = toPipelineKpiRows('2026-06-30', [empty]);
    const byMetric = new Map(rows.map((r) => [r.metricName, r.value]));

    expect(byMetric.get(PIPELINE_METRICS.needsReviewRate)).toBe(0);
    expect(byMetric.get(PIPELINE_METRICS.feedbackDownRatio)).toBe(0);
  });

  it('emits a row set per pipeline', () => {
    const rows = toPipelineKpiRows('2026-06-30', [legacy, { ...legacy, pipelineType: 'STRANDS' }]);

    expect(rows).toHaveLength(8);
    expect(new Set(rows.map((r) => r.dimensions?.pipeline_type))).toEqual(new Set(['LEGACY', 'STRANDS']));
  });
});
