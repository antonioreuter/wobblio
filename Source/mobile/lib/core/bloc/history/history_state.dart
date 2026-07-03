part of 'history_bloc.dart';

enum HistoryStatus { loading, ready, failure }

const List<String> _monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/// One month's worth of receipts, most-recent month first.
class HistoryMonthGroup extends Equatable {
  const HistoryMonthGroup({required this.label, required this.invoices});

  final String label;
  final List<InvoiceSummary> invoices;

  @override
  List<Object?> get props => [label, invoices];
}

/// Single immutable history state. [invoices] is the full unfiltered list;
/// [visibleInvoices]/[monthGroups] apply [searchQuery]. [now] is stamped at
/// load time (injectable via [HistoryBloc]'s `now` param) so "this month" is
/// deterministic under test.
class HistoryState extends Equatable {
  const HistoryState({
    this.status = HistoryStatus.loading,
    this.invoices = const [],
    this.searchQuery = '',
    this.isRefreshing = false,
    this.notice,
    this.now,
  });

  final HistoryStatus status;
  final List<InvoiceSummary> invoices;
  final String searchQuery;
  final bool isRefreshing;
  final String? notice;
  final DateTime? now;

  List<InvoiceSummary> get visibleInvoices {
    final q = searchQuery.trim().toLowerCase();
    if (q.isEmpty) return invoices;
    return invoices
        .where(
          (inv) =>
              inv.merchant.toLowerCase().contains(q) ||
              inv.tags.any((t) => t.toLowerCase().contains(q)),
        )
        .toList();
  }

  /// [visibleInvoices] grouped by calendar month, most-recent month first.
  List<HistoryMonthGroup> get monthGroups {
    final buckets = <String, List<InvoiceSummary>>{};
    for (final inv in visibleInvoices) {
      buckets.putIfAbsent(_monthKey(inv.dateIso), () => []).add(inv);
    }
    final keys = buckets.keys.toList()..sort((a, b) => b.compareTo(a));
    return [
      for (final key in keys)
        HistoryMonthGroup(label: _monthLabel(key), invoices: buckets[key]!),
    ];
  }

  int get scannedCount => invoices.length;

  /// Sum of [invoices] whose transaction date falls in the same calendar
  /// month as [now]. Currency is taken from the first matching invoice
  /// (mixed-currency history is not expected at current launch scope).
  double get totalThisMonth {
    final today = now;
    if (today == null) return 0;
    final key =
        '${today.year.toString().padLeft(4, '0')}-${today.month.toString().padLeft(2, '0')}';
    var sum = 0.0;
    for (final inv in invoices) {
      if (_monthKey(inv.dateIso) == key) sum += inv.total;
    }
    return sum;
  }

  String get thisMonthCurrency {
    final today = now;
    if (today == null) return 'EUR';
    final key =
        '${today.year.toString().padLeft(4, '0')}-${today.month.toString().padLeft(2, '0')}';
    final match = invoices.where((inv) => _monthKey(inv.dateIso) == key);
    return match.isEmpty ? 'EUR' : match.first.currency;
  }

  static String _monthKey(String dateIso) =>
      dateIso.length >= 7 ? dateIso.substring(0, 7) : dateIso;

  static String _monthLabel(String monthKey) {
    final parts = monthKey.split('-');
    if (parts.length != 2) return monthKey;
    final month = int.tryParse(parts[1]);
    if (month == null || month < 1 || month > 12) return monthKey;
    return _monthNames[month - 1];
  }

  HistoryState copyWith({
    HistoryStatus? status,
    List<InvoiceSummary>? invoices,
    String? searchQuery,
    bool? isRefreshing,
    DateTime? now,
    // notice is nullable-with-clear, so use an explicit sentinel.
    Object? notice = _unset,
  }) {
    return HistoryState(
      status: status ?? this.status,
      invoices: invoices ?? this.invoices,
      searchQuery: searchQuery ?? this.searchQuery,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      now: now ?? this.now,
      notice: notice == _unset ? this.notice : notice as String?,
    );
  }

  @override
  List<Object?> get props =>
      [status, invoices, searchQuery, isRefreshing, notice, now];
}

const Object _unset = Object();
