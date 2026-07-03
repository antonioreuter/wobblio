import 'package:flutter_test/flutter_test.dart';
import 'package:wobblio/core/ingestion/invoice_summary.dart';
import 'package:wobblio/core/reports/spend_metrics.dart';

InvoiceSummary _inv(String dateIso, double total) => InvoiceSummary(
      id: dateIso,
      merchant: 'Jumbo',
      dateIso: dateIso,
      total: total,
      currency: 'EUR',
      status: 'PARSED',
      tags: const [],
    );

void main() {
  group('computeSpendMetrics — month', () {
    final now = DateTime(2026, 6, 15);

    test('sums current and prior calendar month and computes delta', () {
      final metrics = computeSpendMetrics(
        [
          _inv('2026-06-02', 40),
          _inv('2026-06-28', 60), // current month = 100
          _inv('2026-05-10', 80), // prior month = 80
          _inv('2026-04-01', 999), // ignored (two months back)
        ],
        now,
        SpendPeriod.month,
      );

      expect(metrics.current, 100);
      expect(metrics.previous, 80);
      expect(metrics.diff, 20);
      expect(metrics.spendingDown, isFalse);
      expect(metrics.deltaPct, closeTo(25, 0.001));
    });

    test('delta is null (not zero) when there was no prior-month spend', () {
      final metrics = computeSpendMetrics(
        [_inv('2026-06-02', 40)],
        now,
        SpendPeriod.month,
      );
      expect(metrics.current, 40);
      expect(metrics.previous, 0);
      expect(metrics.deltaPct, isNull);
    });

    test('spendingDown is true when current < previous', () {
      final metrics = computeSpendMetrics(
        [_inv('2026-06-01', 50), _inv('2026-05-01', 100)],
        now,
        SpendPeriod.month,
      );
      expect(metrics.spendingDown, isTrue);
      expect(metrics.deltaPct, closeTo(-50, 0.001));
    });

    test('crosses a year boundary (Jan → prior Dec)', () {
      final metrics = computeSpendMetrics(
        [_inv('2026-01-05', 30), _inv('2025-12-20', 45)],
        DateTime(2026, 1, 10),
        SpendPeriod.month,
      );
      expect(metrics.current, 30);
      expect(metrics.previous, 45);
    });
  });

  group('computeSpendMetrics — week', () {
    // 2026-06-15 is a Monday → its week is 15..21 Jun; prior week is 8..14 Jun.
    final now = DateTime(2026, 6, 15);

    test('buckets by ISO week (Mon start)', () {
      final metrics = computeSpendMetrics(
        [
          _inv('2026-06-15', 20), // this week (Mon)
          _inv('2026-06-21', 10), // this week (Sun)
          _inv('2026-06-14', 70), // prior week (Sun)
          _inv('2026-06-08', 5), // prior week (Mon)
        ],
        now,
        SpendPeriod.week,
      );
      expect(metrics.current, 30);
      expect(metrics.previous, 75);
      expect(metrics.spendingDown, isTrue);
    });
  });

  group('computeSpendMetrics — parsing', () {
    test('skips rows with an unparseable dateIso', () {
      final metrics = computeSpendMetrics(
        [_inv('not-a-date', 999), _inv('2026-06-03', 10)],
        DateTime(2026, 6, 15),
        SpendPeriod.month,
      );
      expect(metrics.current, 10);
    });

    test('uses only the leading YYYY-MM-DD of a full timestamp', () {
      final metrics = computeSpendMetrics(
        [_inv('2026-06-03T14:30:00Z', 12)],
        DateTime(2026, 6, 15),
        SpendPeriod.month,
      );
      expect(metrics.current, 12);
    });
  });
}
