export interface BudgetFact {
  label: string;
  amount: number;
  remaining: number;
}

export interface PriceFinding {
  product: string;
  yourPrice: number;
  cheapestPrice: number;
  merchant: string;
  observationCount: number;
}

export interface SplitRouteEstimate {
  saving: number;
  storeCount: number;
}

export interface AdvisorFacts {
  language: string;
  currency: string;
  spendThisWeek: number;
  spendLastWeek: number;
  budgets: BudgetFact[];
  priceFindings: PriceFinding[];
  splitRoute: SplitRouteEstimate | null;
}

// Week-over-week spend delta as a percentage (1 decimal), or null when there is
// no prior-week baseline to compare against.
export function deltaPct(thisWeek: number, lastWeek: number): number | null {
  if (lastWeek <= 0) return null;
  return Math.round(((thisWeek - lastWeek) / lastWeek) * 1000) / 10;
}

export function clampWords(text: string, max: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= max ? text.trim() : words.slice(0, max).join(' ');
}

const money = (n: number): string => n.toFixed(2);
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Pre-aggregated facts as an XML document for the B.5 prompt. Values are escaped
// so receipt-derived text can never break out of attributes into instructions.
export function buildFactsXml(facts: AdvisorFacts): string {
  const delta = deltaPct(facts.spendThisWeek, facts.spendLastWeek);
  const budgets = facts.budgets
    .map(b => `    <budget label="${esc(b.label)}" amount="${money(b.amount)}" remaining="${money(b.remaining)}"/>`)
    .join('\n');
  const findings = facts.priceFindings
    .map(f => `    <finding product="${esc(f.product)}" your_price="${money(f.yourPrice)}" cheapest_price="${money(f.cheapestPrice)}" merchant="${esc(f.merchant)}" observations="${f.observationCount}"/>`)
    .join('\n');
  const split = facts.splitRoute
    ? `  <split_route saving="${money(facts.splitRoute.saving)}" stores="${facts.splitRoute.storeCount}"/>`
    : '  <split_route/>';

  return [
    '<facts>',
    `  <language>${esc(facts.language)}</language>`,
    `  <currency>${esc(facts.currency)}</currency>`,
    `  <spend this_week="${money(facts.spendThisWeek)}" last_week="${money(facts.spendLastWeek)}" delta_pct="${delta === null ? 'na' : delta}"/>`,
    '  <budgets>',
    budgets,
    '  </budgets>',
    '  <price_findings>',
    findings,
    '  </price_findings>',
    split,
    '</facts>',
  ].join('\n');
}
