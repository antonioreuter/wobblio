part of 'review_bloc.dart';

enum ReviewStatus { loading, ready, submitting, success, discarded, failure }

/// Editable review form state. Lines/date/total start as the parsed values and are
/// mutated in place by edits; [searchResults] feeds the line bottom sheet.
class ReviewState extends Equatable {
  const ReviewState({
    this.status = ReviewStatus.loading,
    this.invoiceId = '',
    this.merchant = '',
    this.currency = 'EUR',
    this.imageUrl,
    this.rawStatus = '',
    this.transactionDate,
    this.total,
    this.lines = const [],
    this.dirtyLineIds = const {},
    this.searchResults = const [],
    this.searching = false,
    this.notice,
  });

  final ReviewStatus status;
  final String invoiceId;
  final String merchant;
  final String currency;
  final String? imageUrl;
  final String rawStatus;
  final String? transactionDate;
  final double? total;
  final List<InvoiceLineDetail> lines;
  // Ids of lines the user actually edited — only these are sent on Confirm, so an
  // untouched line keeps its parsed values and low-confidence amber.
  final Set<String> dirtyLineIds;
  final List<ProductMatch> searchResults;
  final bool searching;
  final String? notice;

  bool get isSuspectedDuplicate => rawStatus == 'SUSPECTED_DUPLICATE';

  ReviewState copyWith({
    ReviewStatus? status,
    String? invoiceId,
    String? merchant,
    String? currency,
    String? imageUrl,
    String? rawStatus,
    List<InvoiceLineDetail>? lines,
    Set<String>? dirtyLineIds,
    List<ProductMatch>? searchResults,
    bool? searching,
    Object? transactionDate = _unset,
    Object? total = _unset,
    Object? notice = _unset,
  }) {
    return ReviewState(
      status: status ?? this.status,
      invoiceId: invoiceId ?? this.invoiceId,
      merchant: merchant ?? this.merchant,
      currency: currency ?? this.currency,
      imageUrl: imageUrl ?? this.imageUrl,
      rawStatus: rawStatus ?? this.rawStatus,
      transactionDate: transactionDate == _unset
          ? this.transactionDate
          : transactionDate as String?,
      total: total == _unset ? this.total : total as double?,
      lines: lines ?? this.lines,
      dirtyLineIds: dirtyLineIds ?? this.dirtyLineIds,
      searchResults: searchResults ?? this.searchResults,
      searching: searching ?? this.searching,
      notice: notice == _unset ? this.notice : notice as String?,
    );
  }

  @override
  List<Object?> get props => [
        status,
        invoiceId,
        merchant,
        currency,
        imageUrl,
        rawStatus,
        transactionDate,
        total,
        lines,
        dirtyLineIds,
        searchResults,
        searching,
        notice,
      ];
}

const Object _unset = Object();
