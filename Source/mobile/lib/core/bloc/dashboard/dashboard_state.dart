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
    this.inflation,
    this.selectedTag,
    this.isRefreshing = false,
    this.feedback = const {},
    this.notice,
    this.noticeSeq = 0,
  });

  final DashboardStatus status;
  final List<InvoiceSummary> invoices;
  final UsageSummary? usage;
  final InflationInsight? inflation;
  final String? selectedTag;
  final bool isRefreshing;
  final Map<String, FeedbackVerdict> feedback;
  final String? notice;

  /// Monotonic token bumped each time a [notice] is raised. The UI listens on
  /// this — not on the notice text — so two notices with identical text (e.g.
  /// two receipts finishing "Receipt ready — …") still both fire the snackbar.
  final int noticeSeq;

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
    // selectedTag/notice/inflation are nullable-with-clear, so use explicit sentinels.
    Object? inflation = _unset,
    Object? selectedTag = _unset,
    Object? notice = _unset,
  }) {
    final settingNotice = notice != _unset && notice != null;
    return DashboardState(
      status: status ?? this.status,
      invoices: invoices ?? this.invoices,
      usage: usage ?? this.usage,
      inflation:
          inflation == _unset ? this.inflation : inflation as InflationInsight?,
      selectedTag:
          selectedTag == _unset ? this.selectedTag : selectedTag as String?,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      feedback: feedback ?? this.feedback,
      notice: notice == _unset ? this.notice : notice as String?,
      // Bump on every non-null notice so the UI re-fires even for repeated text.
      // Clearing (notice: null) or omitting notice preserves the token.
      noticeSeq: settingNotice ? noticeSeq + 1 : noticeSeq,
    );
  }

  @override
  List<Object?> get props => [
        status,
        invoices,
        usage,
        inflation,
        selectedTag,
        isRefreshing,
        feedback,
        notice,
        noticeSeq,
      ];
}

const Object _unset = Object();
