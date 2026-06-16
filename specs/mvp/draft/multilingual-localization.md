# Draft — Multilingual & Localization

**Status:** draft / parked. Not implemented in Epic 08. Captures the decision to keep
catalog identifiers language-neutral while deferring localized *display*.

## Problem

Wobblio targets multiple countries/languages (NL launch; roadmap incl. BR, US, DE, FR,
IT, PT, ES, CA, GB, AT, DK, CN). Several user-facing strings are currently English-only
or NL-only:

- **Tag display names** — `tagVocabulary.ts` carries `displayNameEn` / `displayNameNl`;
  there is no general per-locale resolution.
- **Category names** — `product_category` has `name` + `name_nl`; other locales absent.
- **Region/country names** — `country` / `country_subdivision` store a single English name.
- **General UI copy** — not externalized into a translation catalog.

## Non-negotiable already decided

**Identifiers stay language-neutral.** Tag keys are slugs (`weekly-groceries`), category
ids are slugs (`cat-groceries`), region codes are ISO 3166-2 (`NL-NB`). Only *display*
strings are localized. This keeps the price index, triggers, and joins locale-independent
and is the precedent set by the existing `name` / `name_nl` columns.

## Candidate approaches (to evaluate later)

1. **Per-locale columns** (extend `name_nl` → `name_de`, …). Simple reads, schema churn
   per language, doesn't scale to 13+ locales.
2. **Translation table** (`(entity_type, entity_id, locale, text)`) — one normalized table
   for categories/tags/regions. Scales, needs a join or a cached lookup at read time.
3. **In-process i18n catalog** (JSON bundles per locale, keyed by slug) for tags +
   categories + UI copy; DB stays slug-only. Mirrors the bundled `tagVocabulary` artifact;
   no DB read-path cost. Region/country display names could ship from the same bundles or
   stay in the reference tables.

Leaning toward (3) for tags/categories/UI (bundled, no read-path cost) + reference-table
English names as the fallback, but defer the decision.

## Out of scope here

- RTL languages, pluralization rules, number/currency formatting beyond `tabular-nums`
  (the webapp already formats currency per the design system).
- Translating user-generated content (free-text notes).

## When to pick this up

Alongside the first non-NL/EN market launch, or when the admin console needs to display
localized catalog labels.
