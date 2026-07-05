import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/bloc/reports/price_report_bloc.dart';
import 'package:wobblio/core/auth/user_profile.dart';
import 'package:wobblio/core/ports/insights_repository.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/reports/inflation_insight.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
const _fullInsight = InflationInsight(
  personalInflationPct: 0.2,
  basketSize: 5,
  regionInflationPct: 6.8,
  savedBySwitching: 312,
  trend: [
    InflationTrendPoint(period: '2026-05', personalIndexPct: 100, regionIndexPct: 100),
    InflationTrendPoint(period: '2026-06', personalIndexPct: 100.2, regionIndexPct: 106.8),
  ],
);

UserProfile _defaultProfile({String country = 'NL', String regionCode = 'NL-NB'}) =>
    UserProfile(
      onboarded: true,
      fullName: 'Antonio',
      role: 'STANDARD',
      status: 'ACTIVE',
      country: country,
      regionCode: regionCode,
    );

// ── Hand-rolled fakes ─────────────────────────────────────────────────────────
class _FakeInsights implements IInsightsRepository {
  _FakeInsights({InflationInsight? insight, this.fail = false})
      : _insight = insight ?? _fullInsight;
  final InflationInsight _insight;
  final bool fail;
  @override
  Future<InflationInsight> fetchInflation() async {
    if (fail) throw Exception('boom');
    return _insight;
  }
}

class _FakeProfile implements IProfileRepository {
  _FakeProfile({UserProfile? profile, this.fail = false})
      : _profile = profile ?? _defaultProfile();
  final UserProfile _profile;
  final bool fail;
  @override
  Future<UserProfile> fetchProfile() async {
    if (fail) throw Exception('boom');
    return _profile;
  }
}

PriceReportBloc _bloc({
  _FakeInsights? insights,
  _FakeProfile? profile,
}) =>
    PriceReportBloc(
      insights: insights ?? _FakeInsights(),
      profile: profile ?? _FakeProfile(),
    );

void main() {
  group('PriceReportBloc', () {
    blocTest<PriceReportBloc, PriceReportState>(
      'loads the insight and labels the region from regionCode',
      build: _bloc,
      act: (b) => b.add(const PriceReportStarted()),
      expect: () => [
        const PriceReportState(status: PriceReportStatus.loading),
        const PriceReportState(
          status: PriceReportStatus.ready,
          insight: _fullInsight,
          regionLabel: 'NL-NB',
        ),
      ],
    );

    blocTest<PriceReportBloc, PriceReportState>(
      'falls back to country when regionCode is empty',
      build: () => _bloc(
        profile: _FakeProfile(profile: _defaultProfile(regionCode: '')),
      ),
      act: (b) => b.add(const PriceReportStarted()),
      expect: () => [
        const PriceReportState(status: PriceReportStatus.loading),
        const PriceReportState(
          status: PriceReportStatus.ready,
          insight: _fullInsight,
          regionLabel: 'NL',
        ),
      ],
    );

    blocTest<PriceReportBloc, PriceReportState>(
      'still becomes ready with an empty label when the profile fetch fails',
      build: () => _bloc(profile: _FakeProfile(fail: true)),
      act: (b) => b.add(const PriceReportStarted()),
      expect: () => [
        const PriceReportState(status: PriceReportStatus.loading),
        const PriceReportState(
          status: PriceReportStatus.ready,
          insight: _fullInsight,
          regionLabel: '',
        ),
      ],
    );

    blocTest<PriceReportBloc, PriceReportState>(
      'passes honest nulls through untouched',
      build: () => _bloc(
        insights: _FakeInsights(
          insight: const InflationInsight(basketSize: 1),
        ),
      ),
      act: (b) => b.add(const PriceReportStarted()),
      expect: () => [
        const PriceReportState(status: PriceReportStatus.loading),
        const PriceReportState(
          status: PriceReportStatus.ready,
          insight: InflationInsight(basketSize: 1),
          regionLabel: 'NL-NB',
        ),
      ],
    );

    blocTest<PriceReportBloc, PriceReportState>(
      'fails when the insight fetch throws',
      build: () => _bloc(insights: _FakeInsights(fail: true)),
      act: (b) => b.add(const PriceReportStarted()),
      expect: () => [
        const PriceReportState(status: PriceReportStatus.loading),
        const PriceReportState(status: PriceReportStatus.failure),
      ],
    );
  });
}
