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

/// Renders a descriptive pack size ("2L", "500g", "3pc") from a base-unit pack quantity + unit
/// (09/01). Sub-unit weights/volumes show in the smaller unit. Returns null when the size is
/// unknown — the chip is then omitted. Pure display; size is never a per-unit price basis.
String? formatSizeChip(double? packQuantity, String? baseUnit) {
  if (packQuantity == null || packQuantity <= 0 || baseUnit == null) return null;
  String n(double v) {
    final r = (v * 1000).roundToDouble() / 1000;
    return r == r.roundToDouble() ? r.toInt().toString() : r.toString();
  }

  switch (baseUnit) {
    case 'KG':
      return packQuantity < 1 ? '${(packQuantity * 1000).round()}g' : '${n(packQuantity)}kg';
    case 'L':
      return packQuantity < 1 ? '${(packQuantity * 1000).round()}ml' : '${n(packQuantity)}L';
    default:
      return '${n(packQuantity)}pc';
  }
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
