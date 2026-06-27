import { TAG_VOCABULARY, TAG_KEYS, type TagDefinition, type TagTrigger } from './tagVocabulary';
import { macroCategoryId } from './categoryTaxonomy';

// §6.10 tag generation: deterministic trigger maps first, then LLM-suggested keys
// (validated against the closed vocabulary), deduped and capped at 3. Deterministic
// tags win ties because they are listed first.

const MAX_TAGS = 3;

// A merchant-identity tag (every trigger is a brand match) asserts WHICH store the receipt
// is from — e.g. supermarket-ah. That is resolved deterministically upstream, so the LLM
// must never assert it: a suggestion is either redundant (the brand matched, already added)
// or wrong (it didn't, mislabelling e.g. an Aldi receipt as supermarket-ah). These keys are
// accepted only from the deterministic trigger path, never from LLM suggestions.
const BRAND_IDENTITY_TAG_KEYS: ReadonlySet<string> = new Set(
  TAG_VOCABULARY.filter(tag => tag.triggers.every(trigger => trigger.merchantBrand !== undefined)).map(tag => tag.key),
);

export interface TagGenerationContext {
  categoryId: string | null;
  merchantBrand: string | null;
  categoryShares: Record<string, number>; // category_id -> 0..1 spend share
  suggestedTags: string[];
}

function triggerMatches(trigger: TagTrigger, ctx: TagGenerationContext): boolean {
  if (trigger.merchantBrand) return ctx.merchantBrand === trigger.merchantBrand;
  const categoryId = trigger.categoryId as string; // vocab triggers always set one of the two
  if (trigger.minSpendShare !== undefined) return (ctx.categoryShares[categoryId] ?? 0) >= trigger.minSpendShare;
  // A bare macro tag describes the invoice's macro category — fire only when that is the
  // invoice's resolved category, not when a single stray line merely touches the macro.
  return ctx.categoryId !== null && macroCategoryId(ctx.categoryId) === categoryId;
}

function isTriggered(tag: TagDefinition, ctx: TagGenerationContext): boolean {
  return tag.triggers.some(trigger => triggerMatches(trigger, ctx));
}

export function generateTags(ctx: TagGenerationContext): string[] {
  const deterministic = TAG_VOCABULARY.filter(tag => isTriggered(tag, ctx)).map(tag => tag.key);
  const suggested = ctx.suggestedTags.filter(key => TAG_KEYS.has(key) && !BRAND_IDENTITY_TAG_KEYS.has(key));
  const merged: string[] = [];
  for (const key of [...deterministic, ...suggested]) {
    if (!merged.includes(key)) merged.push(key);
  }
  return merged.slice(0, MAX_TAGS);
}
