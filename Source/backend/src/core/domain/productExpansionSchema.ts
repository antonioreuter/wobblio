import { extractJsonObject } from './jsonExtract';
import { isValidCategoryId } from './categoryTaxonomy';
import type { BaseUnit } from './unitSize';

// Validates the §6.3 product-expansion LLM output: one canonical item per input line
// (positional), plus piggybacked tag suggestions. base_unit must be a known unit and
// category_id a known category, so downstream FK inserts never fail on bad model output.

export interface ExpandedItem {
  displayName: string;
  categoryId: string;
  baseUnit: BaseUnit;
  packSizeBaseUnits: number | null;
  isDepositOrFee: boolean;
}

export interface ProductExpansion {
  items: ExpandedItem[];
  suggestedTags: string[];
}

export type ProductExpansionResult =
  | { ok: true; value: ProductExpansion }
  | { ok: false; issues: string };

const BASE_UNITS = new Set<BaseUnit>(['KG', 'L', 'PIECE']);

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateItem(item: unknown, index: number, issues: string[]): ExpandedItem | null {
  if (typeof item !== 'object' || item === null) {
    issues.push(`items[${index}] must be an object`);
    return null;
  }
  const i = item as Record<string, unknown>;
  if (typeof i.display_name !== 'string' || i.display_name.trim().length === 0) issues.push(`items[${index}].display_name must be a non-empty string`);
  if (typeof i.category_id !== 'string' || !isValidCategoryId(i.category_id)) issues.push(`items[${index}].category_id must be a known category`);
  if (typeof i.base_unit !== 'string' || !BASE_UNITS.has(i.base_unit as BaseUnit)) issues.push(`items[${index}].base_unit must be one of KG, L, PIECE`);
  if (i.pack_size_base_units !== null && i.pack_size_base_units !== undefined && !isNum(i.pack_size_base_units)) issues.push(`items[${index}].pack_size_base_units must be a number or null`);
  if (typeof i.is_deposit_or_fee !== 'boolean') issues.push(`items[${index}].is_deposit_or_fee must be a boolean`);
  if (issues.length > 0) return null;
  return {
    displayName: (i.display_name as string).trim(),
    categoryId: i.category_id as string,
    baseUnit: i.base_unit as BaseUnit,
    packSizeBaseUnits: (i.pack_size_base_units as number | null | undefined) ?? null,
    isDepositOrFee: i.is_deposit_or_fee as boolean,
  };
}

export function parseProductExpansionJson(content: string, expectedCount: number): ProductExpansionResult {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonObject(content));
  } catch {
    return { ok: false, issues: 'output is not valid JSON' };
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, issues: 'output must be a JSON object' };

  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.items)) return { ok: false, issues: 'items must be an array' };
  if (r.items.length !== expectedCount) return { ok: false, issues: `items must have exactly ${expectedCount} entries (got ${r.items.length})` };
  if (r.suggested_tags !== undefined && !isStringArray(r.suggested_tags)) return { ok: false, issues: 'suggested_tags must be an array of strings' };

  const issues: string[] = [];
  const items: ExpandedItem[] = [];
  for (let index = 0; index < r.items.length; index++) {
    const validated = validateItem(r.items[index], index, issues);
    if (validated) items.push(validated);
  }
  if (issues.length > 0) return { ok: false, issues: issues.join('; ') };

  return { ok: true, value: { items, suggestedTags: (r.suggested_tags as string[] | undefined) ?? [] } };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}
