import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/ui/format.dart';

InvoiceDetail _detail({
  required String currency,
  double? totalHomeCurrency,
  double? fxRateUsed,
  String? homeCurrency,
}) =>
    InvoiceDetail(
      id: 'i1',
      merchant: 'PÃO DE AÇÚCAR',
      status: 'PARSED',
      transactionDate: '2026-07-09',
      total: 726.19,
      currency: currency,
      imageUrl: null,
      lines: const [],
      totalHomeCurrency: totalHomeCurrency,
      fxRateUsed: fxRateUsed,
      homeCurrency: homeCurrency,
    );

void main() {
  group('InvoiceDetail currency conversion header', () {
    test('foreign receipt with a rate shows the conversion + reciprocal rate',
        () {
      // fx_rate_used is stored home-per-receipt-unit (EUR per BRL); the header
      // shows the intuitive receipt-per-home figure (BRL per EUR).
      final detail = _detail(
        currency: 'BRL',
        totalHomeCurrency: 123.42,
        fxRateUsed: 0.16996108,
        homeCurrency: 'EUR',
      );
      expect(detail.showsCurrencyConversion, isTrue);
      expect(detail.exchangeRateLabel, '1 EUR = 5.8837 BRL');
    });

    test('home-currency receipt shows no conversion', () {
      final detail = _detail(
        currency: 'EUR',
        totalHomeCurrency: 726.19,
        fxRateUsed: 1,
        homeCurrency: 'EUR',
      );
      expect(detail.showsCurrencyConversion, isFalse);
      expect(detail.exchangeRateLabel, isNull);
    });

    test('missing rate (unconvertible) shows no conversion', () {
      final detail = _detail(currency: 'BRL', homeCurrency: 'EUR');
      expect(detail.showsCurrencyConversion, isFalse);
      expect(detail.exchangeRateLabel, isNull);
    });
  });

  group('formatMoney', () {
    test('renders BRL with the R\$ symbol', () {
      expect(formatMoney('BRL', 950.80), r'R$950.80');
    });

    test('keeps EUR/USD/GBP symbols and falls back to the ISO code', () {
      expect(formatMoney('EUR', 162.52), '€162.52');
      expect(formatMoney('JPY', 100), 'JPY 100.00');
    });
  });
}
