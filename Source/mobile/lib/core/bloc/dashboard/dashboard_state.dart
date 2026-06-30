part of 'dashboard_bloc.dart';

enum DashboardStatus { loading, ready, failure }

/// Single immutable dashboard state. [invoices] is the full list; [visibleInvoices]
/// applies the [selectedTag] filter; [feedback] holds the optimistic per-invoice
/// verdicts; [notice] is a transient one-shot message for a snackbar.
class DashboardState extends Equatable {
  const DashboardState({
    this.status = DashboardStatus.loading,
    this.invoices = const [],
    this.usage,
    this.selectedTag,
    this.isRefreshing = false,
    this.feedback = const {},
    this.notice,
  });

  final DashboardStatus status;
  final List<InvoiceSummary> invoices;
  final UsageSummary? usage;
  final String? selectedTag;
  final bool isRefreshing;
  final Map<String, FeedbackVerdict> feedback;
  final String? notice;

  /// Tags present on the loaded invoices, de-duplicated and sorted — the chip row
  /// (read side only; no tag-vocabulary endpoint, that's 16h).
  List<String> get availableTags {
    final tags = <String>{for (final inv in invoices) ...inv.tags};
    final sorted = tags.toList()..sort();
    return sorted;
  }

  List<InvoiceSummary> get visibleInvoices {
    final tag = selectedTag;
    if (tag == null) return invoices;
    return invoices.where((inv) => inv.tags.contains(tag)).toList();
  }

  DashboardState copyWith({
    DashboardStatus? status,
    List<InvoiceSummary>? invoices,
    UsageSummary? usage,
    bool? isRefreshing,
    Map<String, FeedbackVerdict>? feedback,
    // selectedTag/notice are nullable-with-clear, so use explicit sentinels.
    Object? selectedTag = _unset,
    Object? notice = _unset,
  }) {
    return DashboardState(
      status: status ?? this.status,
      invoices: invoices ?? this.invoices,
      usage: usage ?? this.usage,
      selectedTag:
          selectedTag == _unset ? this.selectedTag : selectedTag as String?,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      feedback: feedback ?? this.feedback,
      notice: notice == _unset ? this.notice : notice as String?,
    );
  }

  @override
  List<Object?> get props =>
      [status, invoices, usage, selectedTag, isRefreshing, feedback, notice];
}

const Object _unset = Object();
