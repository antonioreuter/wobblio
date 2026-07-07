import { InvalidSpendReportQueryError } from './errors';

// The spend-breakdown report is capped at a rolling 90-day window (§ spec amendment).
// Presets and a custom range all resolve through here so the cap is enforced in one place.
export const MAX_SPEND_RANGE_DAYS = 90;

export type SpendPeriodPreset = 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_90D' | 'CUSTOM';

// A resolved window: `from` inclusive, `to` exclusive — matching compute_budget_spend's
// `>= from AND < to` convention so the report counts the same day boundaries as budgets.
export interface SpendWindow {
  from: string; // yyyy-mm-dd inclusive
  to: string; // yyyy-mm-dd exclusive
}

const DAY_MS = 86_400_000;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function parseIsoDate(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidSpendReportQueryError(`${field} must be an ISO yyyy-mm-dd date`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new InvalidSpendReportQueryError(`${field} is not a valid date`);
  }
  return parsed;
}

// Resolve a preset (or custom from/to) into a `[from, to)` window, rejecting anything
// wider than the 90-day cap. `to` is exclusive; presets end at tomorrow so today is included.
export function resolvePeriod(
  preset: SpendPeriodPreset,
  from: string | null,
  to: string | null,
  now: Date = new Date(),
): SpendWindow {
  const today = utcMidnight(now);
  const tomorrow = addDays(today, 1);

  if (preset === 'THIS_WEEK') {
    // ISO week: Monday start. getUTCDay() is 0 (Sun)..6 (Sat); shift so Monday = 0.
    const mondayOffset = (today.getUTCDay() + 6) % 7;
    return { from: iso(addDays(today, -mondayOffset)), to: iso(tomorrow) };
  }

  if (preset === 'THIS_MONTH') {
    const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { from: iso(first), to: iso(tomorrow) };
  }

  if (preset === 'LAST_90D') {
    // 90 days inclusive of today: from = today-89, to = tomorrow.
    return { from: iso(addDays(today, -(MAX_SPEND_RANGE_DAYS - 1))), to: iso(tomorrow) };
  }

  // CUSTOM — both bounds required; `to` is an inclusive user-picked date, made exclusive here.
  if (!from || !to) {
    throw new InvalidSpendReportQueryError('custom period requires both from and to dates');
  }
  const fromDate = parseIsoDate(from, 'from');
  const toInclusive = parseIsoDate(to, 'to');
  const spanDays = Math.round((toInclusive.getTime() - fromDate.getTime()) / DAY_MS);
  if (spanDays < 0) {
    throw new InvalidSpendReportQueryError('from must be on or before to');
  }
  if (spanDays + 1 > MAX_SPEND_RANGE_DAYS) {
    throw new InvalidSpendReportQueryError(`range cannot exceed ${MAX_SPEND_RANGE_DAYS} days`);
  }
  return { from: iso(fromDate), to: iso(addDays(toInclusive, 1)) };
}

export function isSpendPeriodPreset(value: string): value is SpendPeriodPreset {
  return value === 'THIS_WEEK' || value === 'THIS_MONTH' || value === 'LAST_90D' || value === 'CUSTOM';
}
