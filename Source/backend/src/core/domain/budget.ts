export type BudgetScope = 'TOTAL' | 'CATEGORY' | 'MEMBER' | 'HOUSEHOLD';
export type BudgetPeriod = 'DAY' | 'WEEK' | 'MONTH';

export const MAX_BUDGETS_PER_TENANT = 10;
export const ALERT_85_RATIO = 0.85;
export const NOTIFICATION_TTL_DAYS = 3;

export type AlertKind = 'BUDGET_85' | 'BUDGET_100';

// Exclusive end of the period that starts at cycleStart (ISO yyyy-mm-dd).
export function periodEnd(cycleStart: string, period: BudgetPeriod): string {
  const d = new Date(`${cycleStart}T00:00:00Z`);
  if (period === 'DAY') d.setUTCDate(d.getUTCDate() + 1);
  else if (period === 'WEEK') d.setUTCDate(d.getUTCDate() + 7);
  else addCalendarMonth(d);
  return d.toISOString().slice(0, 10);
}

// Advance one calendar month without overflowing into the month after next
// (e.g. Jan-31 → Feb-28, not Mar-03). Clamp the day to the target month's length.
function addCalendarMonth(d: Date): void {
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const daysInTarget = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, daysInTarget));
}

// Roll cycleStart forward to the period that currently contains `today`. A budget
// whose period has not yet ended is returned unchanged (no future roll).
export function advanceCycleStart(cycleStart: string, period: BudgetPeriod, today: string): string {
  let start = cycleStart;
  while (periodEnd(start, period) <= today) start = periodEnd(start, period);
  return start;
}

const SCOPE_LABEL: Record<BudgetScope, { en: string; nl: string }> = {
  TOTAL: { en: 'total spending', nl: 'totale uitgaven' },
  CATEGORY: { en: 'category', nl: 'categorie' },
  MEMBER: { en: 'member', nl: 'lid' },
  HOUSEHOLD: { en: 'household', nl: 'huishouden' },
};

export interface AlertText {
  title: string;
  body: string;
}

// Locale-aware currency formatting (13-country footprint). language is an ISO code
// from app_user; currency is the tenant's ISO-4217 home_currency.
function formatMoney(amount: number, currency: string, language: string): string {
  return new Intl.NumberFormat(language, { style: 'currency', currency }).format(amount);
}

// System-generated alert copy in the tenant's language (en fallback). Amounts are
// rendered in the tenant's home currency via Intl.NumberFormat.
export function buildBudgetAlert(
  kind: AlertKind,
  scope: BudgetScope,
  targetLabel: string | null,
  amount: number,
  accumulated: number,
  language: string,
  currency: string,
): AlertText {
  const nl = language.toLowerCase().startsWith('nl');
  // Name the specific budget (category/member) when known; fall back to the scope noun.
  const label = targetLabel?.trim() || (nl ? SCOPE_LABEL[scope].nl : SCOPE_LABEL[scope].en);
  const spent = formatMoney(accumulated, currency, language);
  const limit = formatMoney(amount, currency, language);

  if (kind === 'BUDGET_100') {
    return nl
      ? { title: 'Budget bereikt', body: `Je ${label}-budget is overschreden (${spent} van ${limit}).` }
      : { title: 'Budget reached', body: `Your ${label} budget is over the limit (${spent} of ${limit}).` };
  }

  const pct = Math.round((accumulated / amount) * 100);
  return nl
    ? { title: 'Budget op 85%', body: `Je ${label}-budget staat op ${pct}% (${spent} van ${limit}).` }
    : { title: 'Budget at 85%', body: `Your ${label} budget is at ${pct}% (${spent} of ${limit}).` };
}
