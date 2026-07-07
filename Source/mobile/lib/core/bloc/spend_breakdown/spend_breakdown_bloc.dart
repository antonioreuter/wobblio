import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/spend_report_repository.dart';
import 'package:wobblio/core/reports/spend_breakdown.dart';

part 'spend_breakdown_event.dart';
part 'spend_breakdown_state.dart';

/// Owns the mobile Spend Breakdown screen: a drill from category → merchant →
/// item-category → items, with a period filter and a My-region/All-regions
/// scope. Mirrors the web `/spend` page. Item-level drilling is premium — the
/// gate is fail-closed (a profile-read failure keeps the user out, showing the
/// upsell), matching [SplitBillBloc]/BudgetBloc. Widgets stay logic-free
/// (`.claude/rules/flutter-architecture-guard.md`).
class SpendBreakdownBloc
    extends Bloc<SpendBreakdownEvent, SpendBreakdownState> {
  SpendBreakdownBloc({
    required ISpendReportRepository reports,
    required IProfileRepository profile,
  })  : _reports = reports,
        _profile = profile,
        super(const SpendBreakdownState()) {
    on<SpendBreakdownStarted>(_onStarted);
    on<SpendBreakdownReloaded>(_onReloaded);
    on<SpendBreakdownDrilledInto>(_onDrilledInto);
    on<SpendBreakdownCrumbTapped>(_onCrumbTapped);
    on<SpendBreakdownPeriodChanged>(_onPeriodChanged);
    on<SpendBreakdownRegionScopeChanged>(_onRegionScopeChanged);
    on<SpendBreakdownUpsellDismissed>(_onUpsellDismissed);
  }

  final ISpendReportRepository _reports;
  final IProfileRepository _profile;

  Future<void> _onStarted(
    SpendBreakdownStarted event,
    Emitter<SpendBreakdownState> emit,
  ) async {
    emit(const SpendBreakdownState(status: SpendBreakdownStatus.loading));
    var next = const SpendBreakdownState(status: SpendBreakdownStatus.loading);
    try {
      final profile = await _profile.fetchProfile();
      next = next.copyWith(
        isPremium: profile.role != 'STANDARD',
        homeCountry: profile.country,
        homeRegion: profile.regionCode,
        // No home region to scope by → default to All regions so the toggle honestly reflects
        // the (unscoped) data rather than showing "My region" over all-region results.
        allRegions: profile.regionCode.trim().isEmpty,
      );
    } catch (_) {
      next = next.copyWith(isPremium: false); // fail closed
    }
    await _load(next, emit);
  }

  // Retry / re-fetch the current level with the current filters, keeping the drill path.
  Future<void> _onReloaded(
    SpendBreakdownReloaded event,
    Emitter<SpendBreakdownState> emit,
  ) async {
    await _load(state, emit);
  }

  Future<void> _onDrilledInto(
    SpendBreakdownDrilledInto event,
    Emitter<SpendBreakdownState> emit,
  ) async {
    final node = event.node;
    switch (state.level) {
      case SpendLevel.categories:
        await _load(
          state.copyWith(
            categoryId: node.id,
            categoryName: node.name,
            clearMerchant: true,
            clearItemCategory: true,
          ),
          emit,
        );
      case SpendLevel.merchants:
        if (!state.isPremium) {
          emit(state.copyWith(showUpsell: true)); // item-level is premium
          return;
        }
        await _load(
          state.copyWith(
            merchantId: node.id,
            merchantName: node.name,
            clearItemCategory: true,
          ),
          emit,
        );
      case SpendLevel.itemCategories:
        await _load(
          state.copyWith(
            itemCategoryId: node.id,
            itemCategoryName: node.name,
          ),
          emit,
        );
      case SpendLevel.items:
        break; // leaf — no further drill
    }
  }

  // depth 0 = All spend (root), 1 = category, 2 = merchant.
  Future<void> _onCrumbTapped(
    SpendBreakdownCrumbTapped event,
    Emitter<SpendBreakdownState> emit,
  ) async {
    switch (event.depth) {
      case 0:
        await _load(
          state.copyWith(
            clearCategory: true,
            clearMerchant: true,
            clearItemCategory: true,
          ),
          emit,
        );
      case 1:
        await _load(
          state.copyWith(clearMerchant: true, clearItemCategory: true),
          emit,
        );
      case 2:
        await _load(state.copyWith(clearItemCategory: true), emit);
    }
  }

  Future<void> _onPeriodChanged(
    SpendBreakdownPeriodChanged event,
    Emitter<SpendBreakdownState> emit,
  ) async {
    await _load(state.copyWith(period: event.period), emit);
  }

  Future<void> _onRegionScopeChanged(
    SpendBreakdownRegionScopeChanged event,
    Emitter<SpendBreakdownState> emit,
  ) async {
    await _load(state.copyWith(allRegions: event.allRegions), emit);
  }

  void _onUpsellDismissed(
    SpendBreakdownUpsellDismissed event,
    Emitter<SpendBreakdownState> emit,
  ) {
    emit(state.copyWith(showUpsell: false));
  }

  // Fetches the report for `base`'s selection + filters and emits the outcome.
  Future<void> _load(
    SpendBreakdownState base,
    Emitter<SpendBreakdownState> emit,
  ) async {
    emit(
      base.copyWith(status: SpendBreakdownStatus.loading, showUpsell: false),
    );
    try {
      final breakdown = await _reports.fetch(
        SpendQuery(
          period: base.period,
          country: base.allRegions ? '' : base.homeCountry,
          region: base.allRegions ? '' : base.homeRegion,
          categoryId: base.categoryId,
          merchantId: base.merchantId,
          itemCategoryId: base.itemCategoryId,
        ),
      );
      emit(
        base.copyWith(
          status: SpendBreakdownStatus.success,
          breakdown: breakdown,
        ),
      );
    } on ApiException catch (err) {
      emit(
        base.copyWith(
          status: err.statusCode == 403
              ? SpendBreakdownStatus.forbidden
              : SpendBreakdownStatus.failure,
        ),
      );
    } catch (_) {
      emit(base.copyWith(status: SpendBreakdownStatus.failure));
    }
  }
}
