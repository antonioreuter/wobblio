import type { JsonValidation } from './llmJson';

// LLM-as-a-judge output (NF-01/07): two score sets graded against ground truth, plus a short
// rationale. Scores are 0..1 per criterion. Validated with the house {ok,issues} idiom and the
// one-retry-with-errors flow (callJsonWithRetry).
export interface PipelineScores {
  extractionAccuracy: number;
  lineItemCompleteness: number;
  classificationAlignment: number;
  tagRelevance: number;
}

export interface PipelineJudgement {
  legacyScores: PipelineScores;
  agenticScores: PipelineScores;
  analysis: string;
}

export const JUDGE_CRITERIA: ReadonlyArray<{ key: keyof PipelineScores; jsonKey: string; label: string }> = [
  { key: 'extractionAccuracy', jsonKey: 'extraction_accuracy', label: 'Extraction accuracy' },
  { key: 'lineItemCompleteness', jsonKey: 'line_item_completeness', label: 'Line-item completeness' },
  { key: 'classificationAlignment', jsonKey: 'classification_alignment', label: 'Classification alignment' },
  { key: 'tagRelevance', jsonKey: 'tag_relevance', label: 'Tag relevance' },
];

export function parsePipelineJudgeJson(content: string): JsonValidation<PipelineJudgement> {
  const parsed = parseJson(content);
  if (!parsed.ok) return parsed;
  const root = parsed.value;

  const issues: string[] = [];
  const legacyScores = readScores(root.legacy_scores, 'legacy_scores', issues);
  const agenticScores = readScores(root.agentic_scores, 'agentic_scores', issues);
  const analysis = typeof root.analysis === 'string' && root.analysis.trim() !== '' ? root.analysis : null;
  if (analysis === null) issues.push('analysis must be a non-empty string');

  if (issues.length > 0) return { ok: false, issues: issues.join('; ') };
  return { ok: true, value: { legacyScores: legacyScores!, agenticScores: agenticScores!, analysis: analysis! } };
}

function readScores(raw: unknown, label: string, issues: string[]): PipelineScores | null {
  if (typeof raw !== 'object' || raw === null) {
    issues.push(`${label} must be an object`);
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const scores = {} as PipelineScores;
  let valid = true;
  for (const { key, jsonKey } of JUDGE_CRITERIA) {
    const value = obj[jsonKey];
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
      issues.push(`${label}.${jsonKey} must be a number in [0,1]`);
      valid = false;
      continue;
    }
    scores[key] = value;
  }
  return valid ? scores : null;
}

function parseJson(content: string): JsonValidation<Record<string, unknown>> {
  // Strip an optional ```json fence the model may wrap the object in.
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : content).trim();
  try {
    const value = JSON.parse(body);
    if (typeof value !== 'object' || value === null) return { ok: false, issues: 'output is not a JSON object' };
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, issues: 'output is not valid JSON' };
  }
}
