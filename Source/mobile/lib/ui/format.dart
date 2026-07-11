/// Shared display formatting helpers for the UI layer.
library;

/// Formats a monetary amount with its currency symbol (2 decimals). Falls back to
/// the ISO code prefix for currencies without a hardcoded symbol.
String formatMoney(String currency, double amount) {
  final value = amount.toStringAsFixed(2);
  return switch (currency) {
    'EUR' => '€$value',
    'USD' => '\$$value',
    'GBP' => '£$value',
    'BRL' => 'R\$$value',
    _ => '$currency $value',
  };
}

const _weekdayAbbrev = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _monthAbbrev = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// Formats a `YYYY-MM-DD` date (or any ISO timestamp) as a short `"d MMM"`
/// label (e.g. `"12 Jun"`) for the recent-invoices ledger rows. Falls back to
/// the raw input if it can't be parsed (display-only, never throws).
String formatShortDate(String isoDate) {
  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) return isoDate;
  return '${parsed.day} ${_monthAbbrev[parsed.month - 1]}';
}

/// Formats a `YYYY-MM-DD` date as a medium `"d MMM yyyy"` label (e.g.
/// `"11 Jun 2026"`) for the Invoice Detail info rows. Falls back to the raw
/// input if unparsable (display-only, never throws).
String formatMediumDate(String isoDate) {
  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) return isoDate;
  return '${parsed.day} ${_monthAbbrev[parsed.month - 1]} ${parsed.year}';
}

/// Formats a line-item quantity for the `"×N"` column: a whole number drops the
/// decimal (`2.0 → "2"`), a fractional weight keeps it (`0.5 → "0.5"`).
String formatQuantity(double quantity) {
  if (quantity == quantity.roundToDouble()) return quantity.toInt().toString();
  return quantity.toString();
}

/// Formats an ISO timestamp as a short relative label for notification rows:
/// `"Xm"`/`"Xh"` under a day old, `"1d"` for exactly one day, a weekday
/// abbreviation (`"Mon"`) from two days up to a week old, and a short
/// `"MMM d"` date beyond that. No `intl` dependency — this app doesn't use
/// one elsewhere, so the lookup tables above stay hand-rolled. Falls back to
/// `'?'` for an unparsable input rather than throwing (display-only).
String formatRelativeTime(String isoDate) {
  final parsed = DateTime.tryParse(isoDate)?.toUtc();
  if (parsed == null) return '?';
  final diff = DateTime.now().toUtc().difference(parsed);
  if (diff.inMinutes < 1) return 'now';
  if (diff.inHours < 1) return '${diff.inMinutes}m';
  if (diff.inHours < 24) return '${diff.inHours}h';
  if (diff.inDays < 2) return '1d';
  if (diff.inDays < 7) return _weekdayAbbrev[parsed.weekday - 1];
  return '${_monthAbbrev[parsed.month - 1]} ${parsed.day}';
}
