import { extractJsonObject } from './jsonExtract';
import { isValidCategoryId } from './categoryTaxonomy';

// Validates the §6.4 classification-tiebreak LLM output: a single known category id.

export interface ClassificationTiebreak {
  categoryId: string;
}

export type ClassificationTiebreakResult =
  | { ok: true; value: ClassificationTiebreak }
  | { ok: false; issues: string };

export function parseClassificationTiebreakJson(content: string): ClassificationTiebreakResult {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonObject(content));
  } catch {
    return { ok: false, issues: 'output is not valid JSON' };
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, issues: 'output must be a JSON object' };

  const r = raw as Record<string, unknown>;
  if (typeof r.category_id !== 'string') return { ok: false, issues: 'category_id must be a string' };
  if (!isValidCategoryId(r.category_id)) return { ok: false, issues: `category_id is not a known category: ${r.category_id}` };

  return { ok: true, value: { categoryId: r.category_id } };
}
