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
    _ => '$currency $value',
  };
}
