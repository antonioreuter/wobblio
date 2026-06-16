// Canonicalize a raw merchant string for alias matching: uppercase, fold accents,
// drop punctuation and common legal-entity suffixes, collapse whitespace. The same
// normalization is applied when writing new aliases (§6.2), so exact-alias lookups
// compare like with like.

const LEGAL_SUFFIXES = new Set([
  'BV', 'NV', 'GMBH', 'LTD', 'INC', 'LLC', 'SA', 'PLC', 'LDA', 'SL', 'SARL',
  'SPA', 'SRL', 'AG', 'OY', 'AB', 'AS',
]);

export function normalizeMerchantName(raw: string): string {
  const folded = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const depunctuated = folded.replace(/[.,]/g, '').replace(/[^A-Z0-9]+/g, ' ');
  const tokens = depunctuated
    .split(/\s+/)
    .filter(token => token.length > 0 && !LEGAL_SUFFIXES.has(token));
  return tokens.join(' ').trim();
}
