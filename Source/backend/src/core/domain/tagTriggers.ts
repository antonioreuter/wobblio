import { TAG_VOCABULARY, TAG_KEYS, type TagDefinition, type TagTrigger } from './tagVocabulary';
import { macroCategoryId } from './categoryTaxonomy';

// §6.10 tag generation: deterministic trigger maps first, then LLM-suggested keys
// (validated against the closed vocabulary), deduped and capped at 3. Deterministic
// tags win ties because they are listed first.

const MAX_TAGS = 3;

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
  const suggested = ctx.suggestedTags.filter(key => TAG_KEYS.has(key));
  const merged: string[] = [];
  for (const key of [...deterministic, ...suggested]) {
    if (!merged.includes(key)) merged.push(key);
  }
  return merged.slice(0, MAX_TAGS);
}
