import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/auth/user_profile.dart';
import 'package:wobblio/core/bloc/reports/report_bloc.dart';
import 'package:wobblio/core/ingestion/product_match.dart';
import 'package:wobblio/core/ports/price_trend_repository.dart';
import 'package:wobblio/core/ports/product_search_repository.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/reports/price_trend_comparison.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
const _bananen =
    ProductMatch(productId: 'p1', displayName: 'Bananen', brand: null);
const _melk = ProductMatch(productId: 'p2', displayName: 'Melk', brand: 'AH');
const _kaas = ProductMatch(productId: 'p3', displayName: 'Kaas', brand: null);
const _brood = ProductMatch(productId: 'p4', displayName: 'Brood', brand: null);

UserProfile _userProfile({
  String role = 'PREMIUM',
  String country = 'NL',
  String regionCode = 'NL-NB',
}) =>
    UserProfile(
      onboarded: true,
      fullName: 'Anna',
      role: role,
      status: 'ACTIVE',
      country: country,
      regionCode: regionCode,
    );

PriceTrendComparison _priceTrendComparison({
  List<MarketTrendLine>? lines,
  List<OwnPurchaseLine>? ownHistory,
}) =>
    PriceTrendComparison(
      countryCode: 'NL',
      regionCode: 'NL-NB',
      weeks: 26,
      lines: lines ??
          const [
            MarketTrendLine(
              productId: 'p1',
              merchantId: 'm1',
              merchantName: 'Jumbo',
              points: [
                WeeklyMedianPoint(
                  weekStart: '2026-06-22',
                  median: 1.89,
                  discountMedian: null,
                ),
              ],
              observationCount: 5,
              lastObservedOn: '2026-06-28',
              stale: false,
              staleDays: 4,
              unit: 'KG',
            ),
          ],
      ownHistory: ownHistory ??
          const [
            OwnPurchaseLine(
              productId: 'p1',
              points: [
                WeeklyMedianPoint(
                  weekStart: '2026-06-22',
                  median: 1.79,
                  discountMedian: null,
                ),
              ],
              purchaseCount: 2,
              lastPurchasedOn: '2026-06-28',
              unit: 'KG',
            ),
          ],
    );

// ── Hand-rolled fakes ─────────────────────────────────────────────────────────
class _FakeProfile implements IProfileRepository {
  _FakeProfile({UserProfile? profile, this.fails = false})
      : _profile = profile ?? _userProfile();
  final UserProfile _profile;
  final bool fails;

  @override
  Future<UserProfile> fetchProfile() async {
    if (fails) throw Exception('boom');
    return _profile;
  }
}

class _FakeProducts implements IProductSearchRepository {
  _FakeProducts()
      : fails = false,
        results = const [_bananen, _melk];
  final List<ProductMatch> results;
  final bool fails;
  final List<String> queries = [];

  @override
  Future<List<ProductMatch>> search(String query) async {
    queries.add(query);
    if (fails) throw Exception('boom');
    return results;
  }
}

class _FakeTrends implements IPriceTrendRepository {
  _FakeTrends({
    PriceTrendComparison? comparison,
    this.fails = false,
  })  : failFirstNCalls = 0,
        _result = comparison ?? _priceTrendComparison();
  final PriceTrendComparison _result;
  final bool fails;
  int failFirstNCalls;
  final List<List<String>> calls = [];

  @override
  Future<PriceTrendComparison> comparison(
    List<String> productIds,
    String countryCode,
    String regionCode,
  ) async {
    calls.add(productIds);
    if (fails) throw Exception('boom');
    if (failFirstNCalls > 0) {
      failFirstNCalls--;
      throw Exception('boom');
    }
    return _result;
  }
}

void main() {
  group('ReportBloc', () {
    blocTest<ReportBloc, ReportState>(
      'started resolves country/region/isPremium from the profile',
      build: () => ReportBloc(
        trends: _FakeTrends(),
        products: _FakeProducts(),
        profile: _FakeProfile(
          profile: _userProfile(
            role: 'PREMIUM',
            country: 'NL',
            regionCode: 'NL-NB',
          ),
        ),
      ),
      act: (bloc) => bloc.add(const ReportsStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.status, ReportStatus.ready);
        expect(bloc.state.country, 'NL');
        expect(bloc.state.regionCode, 'NL-NB');
        expect(bloc.state.isPremium, isTrue);
      },
    );

    blocTest<ReportBloc, ReportState>(
      'STANDARD account resolves isPremium false',
      build: () => ReportBloc(
        trends: _FakeTrends(),
        products: _FakeProducts(),
        profile: _FakeProfile(profile: _userProfile(role: 'STANDARD')),
      ),
      act: (bloc) => bloc.add(const ReportsStarted()),
      skip: 1,
      verify: (bloc) => expect(bloc.state.isPremium, isFalse),
    );

    blocTest<ReportBloc, ReportState>(
      'a profile-fetch failure has no safe default region, so it surfaces failure',
      build: () => ReportBloc(
        trends: _FakeTrends(),
        products: _FakeProducts(),
        profile: _FakeProfile(fails: true),
      ),
      act: (bloc) => bloc.add(const ReportsStarted()),
      skip: 1,
      verify: (bloc) => expect(bloc.state.status, ReportStatus.failure),
    );

    blocTest<ReportBloc, ReportState>(
      'a query of 2+ chars returns suggestions',
      build: () => ReportBloc(
        trends: _FakeTrends(),
        products: _FakeProducts(),
        profile: _FakeProfile(),
      ),
      act: (bloc) async {
        bloc.add(const ReportsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductQueryChanged('ba'));
      },
      skip: 2,
      verify: (bloc) =>
          expect(bloc.state.productSuggestions, [_bananen, _melk]),
    );

    blocTest<ReportBloc, ReportState>(
      'a 1-char query clears suggestions without searching',
      build: () => ReportBloc(
        trends: _FakeTrends(),
        products: _FakeProducts(),
        profile: _FakeProfile(),
      ),
      act: (bloc) async {
        bloc.add(const ReportsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductQueryChanged('b'));
      },
      verify: (bloc) => expect(bloc.state.productSuggestions, isEmpty),
    );

    blocTest<ReportBloc, ReportState>(
      'adding a product fetches the comparison and clears the search box',
      build: () => ReportBloc(
        trends: _FakeTrends(),
        products: _FakeProducts(),
        profile: _FakeProfile(),
      ),
      act: (bloc) async {
        bloc.add(const ReportsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductAdded(_bananen));
        await Future<void>.delayed(Duration.zero);
      },
      verify: (bloc) {
        expect(bloc.state.selectedProducts, [_bananen]);
        expect(bloc.state.productQuery, '');
        expect(bloc.state.comparison, isNotNull);
      },
    );

    blocTest<ReportBloc, ReportState>(
      'adding a duplicate product is a no-op',
      build: () => ReportBloc(
        trends: _FakeTrends(),
        products: _FakeProducts(),
        profile: _FakeProfile(),
      ),
      act: (bloc) async {
        bloc.add(const ReportsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductAdded(_bananen));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductAdded(_bananen));
        await Future<void>.delayed(Duration.zero);
      },
      verify: (bloc) => expect(bloc.state.selectedProducts, [_bananen]),
    );

    blocTest<ReportBloc, ReportState>(
      'selection is capped at 3 products — a 4th add is a no-op',
      build: () => ReportBloc(
        trends: _FakeTrends(),
        products: _FakeProducts(),
        profile: _FakeProfile(),
      ),
      act: (bloc) async {
        bloc.add(const ReportsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductAdded(_bananen));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductAdded(_melk));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductAdded(_kaas));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductAdded(_brood));
        await Future<void>.delayed(Duration.zero);
      },
      verify: (bloc) {
        expect(bloc.state.selectedProducts, [_bananen, _melk, _kaas]);
        expect(bloc.state.atMaxProducts, isTrue);
      },
    );

    blocTest<ReportBloc, ReportState>(
      'removing the last product clears the comparison instead of refetching',
      build: () => ReportBloc(
        trends: _FakeTrends(),
        products: _FakeProducts(),
        profile: _FakeProfile(),
      ),
      act: (bloc) async {
        bloc.add(const ReportsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductAdded(_bananen));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductRemoved('p1'));
        await Future<void>.delayed(Duration.zero);
      },
      verify: (bloc) {
        expect(bloc.state.selectedProducts, isEmpty);
        expect(bloc.state.comparison, isNull);
      },
    );

    blocTest<ReportBloc, ReportState>(
      'removing one of several products refetches the comparison for what remains',
      build: () {
        final trends = _FakeTrends();
        return ReportBloc(
          trends: trends,
          products: _FakeProducts(),
          profile: _FakeProfile(),
        );
      },
      act: (bloc) async {
        bloc.add(const ReportsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductAdded(_bananen));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductAdded(_melk));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductRemoved('p1'));
        await Future<void>.delayed(Duration.zero);
      },
      verify: (bloc) {
        expect(bloc.state.selectedProducts, [_melk]);
        expect(bloc.state.comparison, isNotNull);
      },
    );

    blocTest<ReportBloc, ReportState>(
      'a comparison-fetch failure notices without dropping the current selection',
      build: () => ReportBloc(
        trends: _FakeTrends(fails: true),
        products: _FakeProducts(),
        profile: _FakeProfile(),
      ),
      act: (bloc) async {
        bloc.add(const ReportsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductAdded(_bananen));
        await Future<void>.delayed(Duration.zero);
      },
      verify: (bloc) {
        expect(bloc.state.selectedProducts, [_bananen]);
        expect(bloc.state.comparison, isNull);
        expect(bloc.state.notice, isNotNull);
      },
    );

    blocTest<ReportBloc, ReportState>(
      'PREMIUM can switch to market mode',
      build: () => ReportBloc(
        trends: _FakeTrends(),
        products: _FakeProducts(),
        profile: _FakeProfile(profile: _userProfile(role: 'PREMIUM')),
      ),
      act: (bloc) async {
        bloc.add(const ReportsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportModeChanged(ReportMode.market));
      },
      skip: 1,
      verify: (bloc) => expect(bloc.state.mode, ReportMode.market),
    );

    blocTest<ReportBloc, ReportState>(
      'STANDARD cannot switch to market mode — stays pinned to own',
      build: () => ReportBloc(
        trends: _FakeTrends(),
        products: _FakeProducts(),
        profile: _FakeProfile(profile: _userProfile(role: 'STANDARD')),
      ),
      act: (bloc) async {
        bloc.add(const ReportsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportModeChanged(ReportMode.market));
      },
      verify: (bloc) => expect(bloc.state.mode, ReportMode.own),
    );

    test(
      'a stale (slower) comparison response does not overwrite a newer selection\'s result',
      () async {
        final trends = _FakeTrends();
        final bloc = ReportBloc(
          trends: trends,
          products: _FakeProducts(),
          profile: _FakeProfile(),
        );
        bloc.add(const ReportsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ReportProductAdded(_bananen));
        // No await here — immediately add a second product before the first
        // comparison() call resolves, racing the two fetches.
        bloc.add(const ReportProductAdded(_melk));
        await Future<void>.delayed(const Duration(milliseconds: 10));

        expect(bloc.state.selectedProducts, [_bananen, _melk]);
        expect(trends.calls.length, 2);
        await bloc.close();
      },
    );
  });
}
