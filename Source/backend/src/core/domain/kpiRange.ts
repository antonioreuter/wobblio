import { InvalidAdminInputError } from '@core/domain/errors';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DateRange {
  from: string;
  to: string;
}

// Resolves an optional from/to window, defaulting `to` to today and `from` to
// `defaultDays` back. Explicitly-provided dates must be YYYY-MM-DD or it throws.
export function resolveRange(from: string | undefined, to: string | undefined, defaultDays: number): DateRange {
  const toDate = normalize(to) ?? isoDate(new Date());
  const fromDate = normalize(from) ?? isoDate(new Date(Date.parse(toDate) - (defaultDays - 1) * DAY_MS));
  if (fromDate > toDate) throw new InvalidAdminInputError('from must be on or before to');
  return { from: fromDate, to: toDate };
}

function normalize(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (!DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new InvalidAdminInputError(`invalid date: ${value} (expected YYYY-MM-DD)`);
  }
  return value;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
