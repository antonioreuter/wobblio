import { describe, it, expect } from 'vitest';
import { parsePipelineJudgeJson } from '@core/domain/pipelineJudgeSchema';

const validScores = {
  extraction_accuracy: 0.9,
  line_item_completeness: 0.8,
  classification_alignment: 1,
  tag_relevance: 0.5,
};
const validJson = JSON.stringify({
  legacy_scores: validScores,
  agentic_scores: { ...validScores, tag_relevance: 0.7 },
  analysis: 'Both extracted the merchant; agentic tagged better.',
});

describe('parsePipelineJudgeJson', () => {
  it('parses a well-formed judgement', () => {
    const result = parsePipelineJudgeJson(validJson);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.legacyScores.extractionAccuracy).toBe(0.9);
    expect(result.value.agenticScores.tagRelevance).toBe(0.7);
    expect(result.value.analysis).toContain('merchant');
  });

  it('strips a ```json code fence', () => {
    const result = parsePipelineJudgeJson('```json\n' + validJson + '\n```');
    expect(result.ok).toBe(true);
  });

  it('rejects a score outside [0,1]', () => {
    const bad = JSON.parse(validJson);
    bad.legacy_scores.extraction_accuracy = 1.5;
    const result = parsePipelineJudgeJson(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContain('legacy_scores.extraction_accuracy');
  });

  it('rejects a missing criterion', () => {
    const bad = JSON.parse(validJson);
    delete bad.agentic_scores.tag_relevance;
    const result = parsePipelineJudgeJson(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContain('agentic_scores.tag_relevance');
  });

  it('rejects an empty analysis', () => {
    const bad = JSON.parse(validJson);
    bad.analysis = '   ';
    const result = parsePipelineJudgeJson(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContain('analysis');
  });

  it('rejects non-JSON content', () => {
    const result = parsePipelineJudgeJson('the receipts look fine');
    expect(result.ok).toBe(false);
  });
});
