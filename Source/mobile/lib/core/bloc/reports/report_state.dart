part of 'report_bloc.dart';

enum ReportStatus { loading, ready, failure }

/// Comparison basis: the caller's own paid prices vs. the crowdsourced local
/// market trend. Market is Premium-only — a STANDARD account stays pinned to
/// `own` (see `ReportBloc._onModeChanged`).
enum ReportMode { own, market }

/// Single immutable Reports state (18e). [comparison] holds both
/// [PriceTrendComparison.lines] (market) and `.ownHistory` (own) at once —
/// switching [mode] is a pure client-side view flip, never a refetch; only
/// [selectedProducts] changing triggers a new `/price-trends/comparison` call.
class ReportState extends Equatable {
  const ReportState({
    this.status = ReportStatus.loading,
    this.selectedProducts = const [],
    this.productQuery = '',
    this.productSuggestions = const [],
    this.searching = false,
    this.country = '',
    this.regionCode = '',
    this.isPremium = false,
    this.mode = ReportMode.own,
    this.comparison,
    this.notice,
  });

  static const maxProducts = 3;

  final ReportStatus status;
  final List<ProductMatch> selectedProducts;
  final String productQuery;
  final List<ProductMatch> productSuggestions;
  final bool searching;
  final String country;
  final String regionCode;
  final bool isPremium;
  final ReportMode mode;
  final PriceTrendComparison? comparison;
  final String? notice;

  bool get atMaxProducts => selectedProducts.length >= maxProducts;

  ReportState copyWith({
    ReportStatus? status,
    List<ProductMatch>? selectedProducts,
    String? productQuery,
    List<ProductMatch>? productSuggestions,
    bool? searching,
    String? country,
    String? regionCode,
    bool? isPremium,
    ReportMode? mode,
    // comparison/notice are nullable-with-clear, so use explicit sentinels.
    Object? comparison = _unset,
    Object? notice = _unset,
  }) {
    return ReportState(
      status: status ?? this.status,
      selectedProducts: selectedProducts ?? this.selectedProducts,
      productQuery: productQuery ?? this.productQuery,
      productSuggestions: productSuggestions ?? this.productSuggestions,
      searching: searching ?? this.searching,
      country: country ?? this.country,
      regionCode: regionCode ?? this.regionCode,
      isPremium: isPremium ?? this.isPremium,
      mode: mode ?? this.mode,
      comparison: comparison == _unset
          ? this.comparison
          : comparison as PriceTrendComparison?,
      notice: notice == _unset ? this.notice : notice as String?,
    );
  }

  @override
  List<Object?> get props => [
        status,
        selectedProducts,
        productQuery,
        productSuggestions,
        searching,
        country,
        regionCode,
        isPremium,
        mode,
        comparison,
        notice,
      ];
}

const Object _unset = Object();
