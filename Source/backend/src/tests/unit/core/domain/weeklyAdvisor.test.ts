import { describe, it, expect } from 'vitest';
import { deltaPct, clampWords, buildFactsXml, type AdvisorFacts } from '@core/domain/weeklyAdvisor';

describe('deltaPct', () => {
  it('computes a negative delta when spend fell', () => {
    expect(deltaPct(15, 20)).toBe(-25);
  });

  it('computes a positive delta when spend rose', () => {
    expect(deltaPct(20, 10)).toBe(100);
  });

  it('returns null without a prior-week baseline', () => {
    expect(deltaPct(15, 0)).toBeNull();
  });
});

describe('clampWords', () => {
  it('leaves short text untouched', () => {
    expect(clampWords('save on milk', 120)).toBe('save on milk');
  });

  it('truncates to the word limit', () => {
    expect(clampWords('a b c d e', 3)).toBe('a b c');
  });
});

describe('buildFactsXml', () => {
  const facts: AdvisorFacts = {
    language: 'nl',
    currency: 'EUR',
    spendThisWeek: 12.5,
    spendLastWeek: 20,
    budgets: [{ label: 'Total spending', amount: 100, remaining: 12.5 }],
    priceFindings: [{ product: 'Melk', yourPrice: 1.2, cheapestPrice: 0.99, merchant: 'Lidl', observationCount: 8 }],
    splitRoute: null,
  };

  it('emits a single facts document with the computed delta', () => {
    const xml = buildFactsXml(facts);
    expect(xml).toContain('<facts>');
    expect(xml).toContain('<language>nl</language>');
    expect(xml).toContain('delta_pct="-37.5"');
    expect(xml).toContain('<finding product="Melk"');
    expect(xml).toContain('<split_route/>');
  });

  it('renders the split-route estimate when present', () => {
    const xml = buildFactsXml({ ...facts, splitRoute: { saving: 7.4, storeCount: 2 } });
    expect(xml).toContain('<split_route saving="7.40" stores="2"/>');
  });

  it('renders delta_pct as na without a prior-week baseline', () => {
    const xml = buildFactsXml({ ...facts, spendLastWeek: 0 });
    expect(xml).toContain('delta_pct="na"');
  });

  it('escapes attribute values so receipt text cannot break out', () => {
    const xml = buildFactsXml({
      ...facts,
      priceFindings: [{ product: '12" Pizza & <b>', yourPrice: 5, cheapestPrice: 4, merchant: 'X', observationCount: 3 }],
    });
    expect(xml).toContain('&quot;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;b&gt;');
  });
});
