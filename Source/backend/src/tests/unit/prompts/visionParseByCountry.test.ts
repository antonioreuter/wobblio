import { describe, it, expect } from 'vitest';
import { composeCountryVisionPrompt, resolvePack, DEFAULT_PACK, NL_PACK, BR_PACK } from '../../../prompts/visionParseByCountry';
import { VISION_PARSE_PROMPT } from '../../../prompts/visionParse';

// The composer is pure — it selects a country pack and fills the base skeleton. These
// tests pin the two behaviours the study depends on: a registered country gets its pack,
// and everything else (missing / unknown country) falls back to the neutral default.

describe('resolvePack', () => {
  it('returns the registered pack for a country (case-insensitive)', () => {
    expect(resolvePack('NL')).toBe(NL_PACK);
    expect(resolvePack('nl')).toBe(NL_PACK);
    expect(resolvePack('BR')).toBe(BR_PACK);
    expect(resolvePack('br')).toBe(BR_PACK);
  });

  it('falls back to the default pack for an unregistered country', () => {
    expect(resolvePack('JP')).toBe(DEFAULT_PACK);
  });

  it('falls back to the default pack when no country is given', () => {
    expect(resolvePack(undefined)).toBe(DEFAULT_PACK);
  });
});

describe('composeCountryVisionPrompt', () => {
  it('encodes the resolved pack code in the version string', () => {
    expect(composeCountryVisionPrompt('NL').version).toBe('vision-parse/v9c+nl');
    expect(composeCountryVisionPrompt('BR').version).toBe('vision-parse/v9c+br');
    expect(composeCountryVisionPrompt('JP').version).toBe('vision-parse/v9c+default');
    expect(composeCountryVisionPrompt(undefined).version).toBe('vision-parse/v9c+default');
  });

  it('injects every slot — no placeholder survives', () => {
    for (const country of ['NL', 'BR', 'JP', undefined]) {
      const { template } = composeCountryVisionPrompt(country);
      expect(template).not.toContain('{{EXCLUSION_LIST}}');
      expect(template).not.toContain('{{CURRENCY_DATE_HINT}}');
      expect(template).not.toContain('{{EXAMPLES}}');
    }
  });

  it('carries the NL vocabulary and worked examples into the NL prompt', () => {
    const { template } = composeCountryVisionPrompt('NL');
    expect(template).toContain('BONUSKAART'); // NL loyalty token
    expect(template).toContain('JUMBO supermarkten'); // NL worked example
  });

  it('carries Portuguese fiscal vocabulary and a cupom-fiscal example into the BR prompt', () => {
    const { template } = composeCountryVisionPrompt('BR');
    expect(template).toContain('TROCO'); // BR payment/change token
    expect(template).toContain('Trib aprox'); // BR tax-noise token
    expect(template).toContain('PÃO DE AÇÚCAR'); // BR worked example
    expect(template).toContain('BRL');
  });

  it('keeps one country\'s vocabulary out of another\'s prompt', () => {
    const br = composeCountryVisionPrompt('BR').template;
    expect(br).not.toContain('BONUSKAART');
    expect(br).not.toContain('STATIEGELD');
    const nl = composeCountryVisionPrompt('NL').template;
    expect(nl).not.toContain('PÃO DE AÇÚCAR');
    expect(nl).not.toContain('Trib aprox');
  });

  it('keeps country-specific vocabulary out of the default prompt', () => {
    const { template } = composeCountryVisionPrompt('JP');
    expect(template).not.toContain('BONUSKAART');
    expect(template).not.toContain('PÃO DE AÇÚCAR');
  });

  it('preserves the shared universal rules from the production prompt', () => {
    const { template } = composeCountryVisionPrompt('NL');
    // A rule that lives in the shared base, verbatim from the production monolith.
    expect(VISION_PARSE_PROMPT).toContain('You are a receipt OCR extraction engine');
    expect(template).toContain('You are a receipt OCR extraction engine');
    expect(template).toContain('Self-reconciliation');
  });
});

// Drift guard: the composed NL prompt and the still-live v9 monolith (visionParse.ts, the
// production PDF path) carry the same universal rules + NL exclusion vocabulary + worked
// examples in two places. This pins them equal section-by-section so a fix applied to only
// one file fails the build — the same discipline seed_merchants.test.ts uses for the frozen
// seed copies. (date_and_currency is intentionally NOT pinned: the NL pack tightened it.)
describe('NL composed prompt stays pinned to the v9 monolith', () => {
  // Match the block form (`<tag>\n…\n</tag>`), not inline prose mentions like
  // "defined in <schema>." — anchoring the open tag to a newline excludes those.
  const section = (prompt: string, tag: string): string => {
    const match = prompt.match(new RegExp(`<${tag}>\\n([\\s\\S]*?)\\n</${tag}>`));
    if (!match) throw new Error(`section <${tag}> not found`);
    return match[1];
  };
  const nl = composeCountryVisionPrompt('NL').template;
  const PINNED = [
    'security', 'document_check', 'merchant', 'extraction', 'accuracy', 'location',
    'output_rules', 'unreadable_schema', 'schema', 'exclusion_list', 'example_1', 'example_2',
  ];

  it.each(PINNED)('section <%s> matches visionParse.ts verbatim', (tag) => {
    expect(section(nl, tag)).toBe(section(VISION_PARSE_PROMPT, tag));
  });

  it('opens with the same header line', () => {
    const header = 'You are a receipt OCR extraction engine.';
    expect(nl.startsWith(header)).toBe(true);
    expect(VISION_PARSE_PROMPT.startsWith(header)).toBe(true);
  });
});
