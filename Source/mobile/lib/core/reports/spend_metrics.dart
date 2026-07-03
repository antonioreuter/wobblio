import 'package:wobblio/core/ingestion/invoice_summary.dart';

/// Which period the Home hero aggregates over (the prototype's Month/Week toggle).
enum SpendPeriod { month, week }

/// Grocery-spend totals for the current period and the one before it, plus the
/// signed percentage change — the data behind `OPTION 2A`'s Home hero and its
/// "Vs last month" metric. Ported from the webapp's client-side
/// `computeSpendMetrics` (`Source/webapp/src/lib/invoice-metrics.ts`): the
/// backend has no spend-aggregate endpoint, this is derived from the invoice
/// list the client already holds.
class SpendMetrics {
  const SpendMetrics({
    required this.current,
    required this.previous,
    required this.deltaPct,
  });

  /// Total spend in the current period (this month / this week).
  final double current;

  /// Total spend in the immediately prior period.
  final double previous;

  /// Signed % change vs [previous]; `null` when there was no prior-period spend
  /// (division by zero — never coerced to 0, mirroring the webapp).
  final double? deltaPct;

  /// Signed absolute change (negative = spending less).
  double get diff => current - previous;

  /// True when the current period spent less than the prior one (a "good"
  /// delta, rendered in the success color).
  bool get spendingDown => deltaPct != null && deltaPct! < 0;
}

/// Computes [SpendMetrics] for [period] as of [now]. Uses plain calendar-date
/// arithmetic (no UTC conversion) so a date-only `dateIso` like `"2026-06-12"`
/// can't drift a day across timezones the way `DateTime.parse(...).toUtc()`
/// would for a NL-local user.
SpendMetrics computeSpendMetrics(
  Iterable<InvoiceSummary> invoices,
  DateTime now,
  SpendPeriod period,
) {
  final currentKey = _periodKey(now.year, now.month, now.day, period);
  final previousKey = period == SpendPeriod.month
      ? currentKey - 1 // adjacent month ordinal
      : currentKey - 7; // the Monday 7 days earlier

  var current = 0.0;
  var previous = 0.0;
  for (final inv in invoices) {
    final date = _calendarDate(inv.dateIso);
    if (date == null) continue;
    final key = _periodKey(date.$1, date.$2, date.$3, period);
    if (key == currentKey) current += inv.total;
    if (key == previousKey) previous += inv.total;
  }

  return SpendMetrics(
    current: current,
    previous: previous,
    deltaPct: previous > 0 ? ((current - previous) / previous) * 100 : null,
  );
}

/// For MONTH: a month ordinal (`year*12 + (month-1)`) so adjacent months differ
/// by 1. For WEEK: the epoch-day number of that date's Monday, so adjacent
/// weeks differ by 7.
int _periodKey(int year, int month, int day, SpendPeriod period) {
  if (period == SpendPeriod.month) return year * 12 + (month - 1);
  // UTC has no DST, so every day is exactly 24h — the epoch-day of this date's
  // Monday is a stable week ordinal. Using local time here could truncate a
  // day across a DST transition and misbucket a boundary date.
  final date = DateTime.utc(year, month, day);
  final monday = date.subtract(Duration(days: date.weekday - 1));
  return monday.difference(DateTime.utc(1970)).inDays;
}

/// Extracts `(year, month, day)` from the leading `YYYY-MM-DD` of [dateIso].
/// Returns null when the prefix isn't a parseable date (row skipped, never
/// counted as spend).
(int, int, int)? _calendarDate(String dateIso) {
  if (dateIso.length < 10) return null;
  final year = int.tryParse(dateIso.substring(0, 4));
  final month = int.tryParse(dateIso.substring(5, 7));
  final day = int.tryParse(dateIso.substring(8, 10));
  if (year == null || month == null || day == null) return null;
  return (year, month, day);
}
