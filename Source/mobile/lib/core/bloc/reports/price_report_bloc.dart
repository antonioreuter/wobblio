import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/ports/insights_repository.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/reports/inflation_insight.dart';

part 'price_report_event.dart';
part 'price_report_state.dart';

/// Owns the Reports "Price report" screen (19f, prototype 2a `data-screen="6"`):
/// the caller's personal-inflation index vs. their region, plus the €-saved-by-
/// switching headline. All figures come straight from `GET /me/insights/inflation`
/// via [IInsightsRepository] — the screen renders honest empty states for any that
/// are null (rule #4), never a fabricated number.
///
/// The insight fetch is required: a throw surfaces [PriceReportStatus.failure]
/// (with a retry). The profile fetch is only for the region subtitle, so it's
/// best-effort — a failure there just leaves [PriceReportState.regionLabel] empty,
/// mirroring the `DashboardBloc` best-effort-inflation pattern (19c). Widgets stay
/// logic-free (`.claude/rules/flutter-architecture-guard.md`).
class PriceReportBloc extends Bloc<PriceReportEvent, PriceReportState> {
  PriceReportBloc({
    required IInsightsRepository insights,
    required IProfileRepository profile,
  })  : _insights = insights,
        _profile = profile,
        super(const PriceReportState()) {
    on<PriceReportStarted>(_onStarted);
  }

  final IInsightsRepository _insights;
  final IProfileRepository _profile;

  Future<void> _onStarted(
    PriceReportStarted event,
    Emitter<PriceReportState> emit,
  ) async {
    emit(state.copyWith(status: PriceReportStatus.loading));
    final regionLabel = await _resolveRegionLabel();
    try {
      final insight = await _insights.fetchInflation();
      emit(
        state.copyWith(
          status: PriceReportStatus.ready,
          insight: insight,
          regionLabel: regionLabel,
        ),
      );
    } catch (_) {
      emit(state.copyWith(status: PriceReportStatus.failure));
    }
  }

  // Best-effort: the region name only labels the subtitle. `regionCode` (e.g.
  // "NL-NB") is preferred, falling back to the country, then empty — the screen
  // shows a plain "Last 90 days" when there's nothing to name.
  Future<String> _resolveRegionLabel() async {
    try {
      final profile = await _profile.fetchProfile();
      if (profile.regionCode.isNotEmpty) return profile.regionCode;
      return profile.country;
    } catch (_) {
      return '';
    }
  }
}
