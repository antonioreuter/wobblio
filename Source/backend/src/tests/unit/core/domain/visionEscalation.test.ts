import { describe, it, expect } from 'vitest';
import {
  scoreParseQuality,
  decideEscalation,
  ESCALATION_TIER_ROLE,
  DEFAULT_ESCALATION_THRESHOLDS,
  type EscalationThresholds,
} from '@core/domain/visionEscalation';

const T: EscalationThresholds = DEFAULT_ESCALATION_THRESHOLDS;
const tol = T.reconciliationTolerancePct;

describe('scoreParseQuality', () => {
  it('collapses to ~0 when arithmetic fails despite high model confidence (the Qwen 0.92 case)', () => {
    // Estância: model says 0.92 but Σ lines 899 vs total 847 (6% off, >> 2% tol).
    const score = scoreParseQuality(
      { modelConfidence: 0.92, total: 847, lineSum: 899, parsedItemCount: 62 },
      tol,
    );
    expect(score.reconciliationScore).toBe(0);
    expect(score.blended).toBe(0);
    expect(decideEscalation(score.blended, T)).toBe('FALLBACK_DEEP');
  });

  it('accepts a clean parse: high confidence, Σ matches, full coverage', () => {
    const score = scoreParseQuality(
      { modelConfidence: 0.95, total: 100, lineSum: 100, parsedItemCount: 10, statedItemCount: 10 },
      tol,
    );
    expect(score.blended).toBeCloseTo(0.95, 5);
    expect(decideEscalation(score.blended, T)).toBe('NONE');
  });

  it('routes to the mid tier when only reconciliation is slightly off', () => {
    // residual 1% of 2% tol → reconScore 0.5 → in [deepMax 0.55? no]; tune: 0.6% → 0.7.
    const score = scoreParseQuality(
      { modelConfidence: 0.95, total: 1000, lineSum: 1006, parsedItemCount: 20 },
      tol,
    );
    expect(score.reconciliationScore).toBeCloseTo(0.7, 5); // 1 - (0.006/0.02)
    expect(score.blended).toBeCloseTo(0.7, 5);
    expect(decideEscalation(score.blended, T)).toBe('FALLBACK');
  });

  it('does not penalize coverage when the receipt prints no item count', () => {
    const score = scoreParseQuality(
      { modelConfidence: 0.9, total: 50, lineSum: 50, parsedItemCount: 3 },
      tol,
    );
    expect(score.coverageScore).toBe(1);
    expect(score.blended).toBeCloseTo(0.9, 5);
  });

  it('drops the score when many printed items are missing', () => {
    const score = scoreParseQuality(
      { modelConfidence: 0.95, total: 100, lineSum: 100, parsedItemCount: 40, statedItemCount: 69 },
      tol,
    );
    expect(score.coverageScore).toBeCloseTo(40 / 69, 5);
    expect(score.blended).toBeCloseTo(40 / 69, 5);
  });

  it('scores reconciliation 0 for a non-positive total', () => {
    expect(scoreParseQuality({ modelConfidence: 1, total: 0, lineSum: 0, parsedItemCount: 1 }, tol).reconciliationScore).toBe(0);
  });

  it('clamps model confidence into [0,1]', () => {
    expect(scoreParseQuality({ modelConfidence: 1.4, total: 10, lineSum: 10, parsedItemCount: 1 }, tol).modelConfidence).toBe(1);
  });
});

describe('decideEscalation', () => {
  it('treats acceptMin as inclusive (NONE) and deepMax as inclusive of FALLBACK', () => {
    expect(decideEscalation(T.acceptMin, T)).toBe('NONE');
    expect(decideEscalation(T.deepMax, T)).toBe('FALLBACK');
    expect(decideEscalation(T.deepMax - 0.0001, T)).toBe('FALLBACK_DEEP');
  });

  it('fails open to NONE on invalid thresholds (deepMax >= acceptMin)', () => {
    const bad: EscalationThresholds = { acceptMin: 0.5, deepMax: 0.6, reconciliationTolerancePct: 0.02 };
    expect(decideEscalation(0.1, bad)).toBe('NONE');
  });
});

describe('ESCALATION_TIER_ROLE', () => {
  it('maps tiers to their SSM model roles', () => {
    expect(ESCALATION_TIER_ROLE.FALLBACK).toBe('vision_fallback');
    expect(ESCALATION_TIER_ROLE.FALLBACK_DEEP).toBe('vision_fallback_deep');
  });
});
