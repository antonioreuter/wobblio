import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/ingestion/product_match.dart';
import 'package:wobblio/core/ports/price_trend_repository.dart';
import 'package:wobblio/core/ports/product_search_repository.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/reports/price_trend_comparison.dart';

part 'report_event.dart';
part 'report_state.dart';

/// Owns the Reports screen (18e): a price-trend comparison chart, scoped down
/// from `OPTION 2A`'s category/merchant drill-down (no backend support for
/// that — see `specs/mvp/18-mobile-navigation-and-lists/18e-reports.md`).
///
/// Unlike [ShoppingListBloc]/[BudgetBloc]'s fail-closed-to-a-safe-default
/// pattern, a failed profile fetch here has no safe fallback — `country`/
/// `regionCode` are required to query `/price-trends/comparison` at all, so
/// [ReportsStarted] surfaces a genuine [ReportStatus.failure] (with a retry)
/// rather than degrading. Once loaded, product search mirrors [ReviewBloc]'s
/// `_onProductSearched` (min 2 chars, a generation counter dropping stale
/// responses) — the exact same port, [IProductSearchRepository]. Comparison
/// refetches are tied only to [selectedProducts] changing (add/remove), never
/// to [ReportProductQueryChanged] — so typing in the search box never
/// re-fetches the chart. Widgets stay logic-free
/// (`.claude/rules/flutter-architecture-guard.md`).
class ReportBloc extends Bloc<ReportEvent, ReportState> {
  ReportBloc({
    required IPriceTrendRepository trends,
    required IProductSearchRepository products,
    required IProfileRepository profile,
  })  : _trends = trends,
        _products = products,
        _profile = profile,
        super(const ReportState()) {
    on<ReportsStarted>(_onStarted);
    on<ReportProductQueryChanged>(_onProductQueryChanged);
    on<ReportProductAdded>(_onProductAdded);
    on<ReportProductRemoved>(_onProductRemoved);
    on<ReportModeChanged>(_onModeChanged);
  }

  final IPriceTrendRepository _trends;
  final IProductSearchRepository _products;
  final IProfileRepository _profile;

  // Bumped per search/comparison fetch so a slower earlier response can't
  // overwrite newer results — mirrors ReviewBloc's `_searchGen`.
  int _searchGen = 0;
  int _comparisonGen = 0;

  Future<void> _onStarted(
    ReportsStarted event,
    Emitter<ReportState> emit,
  ) async {
    emit(state.copyWith(status: ReportStatus.loading));
    try {
      final profile = await _profile.fetchProfile();
      emit(
        state.copyWith(
          status: ReportStatus.ready,
          country: profile.country,
          regionCode: profile.regionCode,
          isPremium: profile.role != 'STANDARD',
        ),
      );
    } catch (_) {
      emit(state.copyWith(status: ReportStatus.failure));
    }
  }

  Future<void> _onProductQueryChanged(
    ReportProductQueryChanged event,
    Emitter<ReportState> emit,
  ) async {
    final gen = ++_searchGen;
    final trimmed = event.query.trim();
    emit(state.copyWith(productQuery: event.query));
    if (trimmed.length < 2) {
      emit(state.copyWith(productSuggestions: const [], searching: false));
      return;
    }
    emit(state.copyWith(searching: true));
    try {
      final results = await _products.search(trimmed);
      if (gen != _searchGen) return; // a newer keystroke superseded this search
      emit(state.copyWith(productSuggestions: results, searching: false));
    } catch (_) {
      if (gen != _searchGen) return;
      emit(state.copyWith(productSuggestions: const [], searching: false));
    }
  }

  Future<void> _onProductAdded(
    ReportProductAdded event,
    Emitter<ReportState> emit,
  ) async {
    if (state.atMaxProducts) return;
    if (state.selectedProducts
        .any((p) => p.productId == event.product.productId)) {
      return;
    }
    final updated = [...state.selectedProducts, event.product];
    emit(
      state.copyWith(
        selectedProducts: updated,
        productQuery: '',
        productSuggestions: const [],
        notice: null,
      ),
    );
    await _refreshComparison(emit, updated);
  }

  Future<void> _onProductRemoved(
    ReportProductRemoved event,
    Emitter<ReportState> emit,
  ) async {
    final updated = state.selectedProducts
        .where((p) => p.productId != event.productId)
        .toList();
    if (updated.isEmpty) {
      // No products left — nothing to compare, and no sane empty-selection
      // query to send, so clear the chart instead of calling the repository.
      emit(
        state.copyWith(
          selectedProducts: updated,
          comparison: null,
          notice: null,
        ),
      );
      return;
    }
    emit(state.copyWith(selectedProducts: updated, notice: null));
    await _refreshComparison(emit, updated);
  }

  void _onModeChanged(ReportModeChanged event, Emitter<ReportState> emit) {
    // Market is Premium-only; the screen renders an upsell instead of a
    // tappable toggle for non-Premium, but guard here too in case that ever
    // drifts — same defensive shape as `BudgetBloc`'s server-side re-check.
    if (event.mode == ReportMode.market && !state.isPremium) return;
    emit(state.copyWith(mode: event.mode));
  }

  Future<void> _refreshComparison(
    Emitter<ReportState> emit,
    List<ProductMatch> products,
  ) async {
    final gen = ++_comparisonGen;
    try {
      final result = await _trends.comparison(
        [for (final p in products) p.productId],
        state.country,
        state.regionCode,
      );
      if (gen != _comparisonGen) {
        return; // a newer selection superseded this fetch
      }
      emit(state.copyWith(comparison: result));
    } catch (_) {
      if (gen != _comparisonGen) return;
      emit(
        state.copyWith(
          notice: 'Couldn’t load price trends — please try again.',
        ),
      );
    }
  }
}
