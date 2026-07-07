import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/bloc/spend_breakdown/spend_breakdown_bloc.dart';
import 'package:wobblio/core/auth/user_profile.dart';
import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/spend_report_repository.dart';
import 'package:wobblio/core/reports/spend_breakdown.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
const _catNode = SpendNode(
  id: 'cat-groceries',
  name: 'Groceries',
  amount: 100,
  pct: 100,
  count: 4,
);
const _merchantNode =
    SpendNode(id: 'm1', name: 'Jumbo', amount: 50, pct: 50, count: 2);

UserProfile _profile(String role, {String regionCode = 'NL-NB'}) => UserProfile(
      onboarded: true,
      fullName: 'A',
      role: role,
      status: 'ACTIVE',
      country: 'NL',
      regionCode: regionCode,
    );

// Fake that returns a canned breakdown for whichever level the query implies, and
// records the last query so tests can assert the drill parameters.
class _FakeReports implements ISpendReportRepository {
  _FakeReports({this.throw403 = false});
  final bool throw403;
  SpendQuery? lastQuery;

  @override
  Future<SpendBreakdown> fetch(SpendQuery query) async {
    lastQuery = query;
    if (throw403) throw const ApiException('premium', statusCode: 403);
    final level = query.categoryId == null
        ? SpendLevel.categories
        : query.merchantId == null
            ? SpendLevel.merchants
            : query.itemCategoryId == null
                ? SpendLevel.itemCategories
                : SpendLevel.items;
    return SpendBreakdown(
      level: level,
      currency: 'EUR',
      total: 100,
      nodes: [
        SpendNode(
          id: 'node-${level.name}',
          name: 'Node',
          amount: 100,
          pct: 100,
          count: 1,
        ),
      ],
    );
  }
}

class _FakeProfile implements IProfileRepository {
  _FakeProfile(this.role, {this.regionCode = 'NL-NB'});
  final String role;
  final String regionCode;
  @override
  Future<UserProfile> fetchProfile() async =>
      _profile(role, regionCode: regionCode);
}

SpendBreakdownBloc _bloc({_FakeReports? reports, String role = 'PREMIUM'}) =>
    SpendBreakdownBloc(
      reports: reports ?? _FakeReports(),
      profile: _FakeProfile(role),
    );

void main() {
  group('SpendBreakdownBloc', () {
    blocTest<SpendBreakdownBloc, SpendBreakdownState>(
      'loads the top (category) level on start',
      build: _bloc,
      act: (b) => b.add(const SpendBreakdownStarted()),
      verify: (b) {
        expect(b.state.status, SpendBreakdownStatus.success);
        expect(b.state.isPremium, isTrue);
        expect(b.state.breakdown?.level, SpendLevel.categories);
        expect(b.state.level, SpendLevel.categories);
      },
    );

    blocTest<SpendBreakdownBloc, SpendBreakdownState>(
      'maps a backend 403 to the forbidden state',
      build: () => _bloc(reports: _FakeReports(throw403: true)),
      act: (b) => b.add(const SpendBreakdownStarted()),
      verify: (b) => expect(b.state.status, SpendBreakdownStatus.forbidden),
    );

    blocTest<SpendBreakdownBloc, SpendBreakdownState>(
      'drilling a category fetches the merchant level with the category id',
      build: _bloc,
      seed: () => const SpendBreakdownState(
        status: SpendBreakdownStatus.success,
        isPremium: true,
      ),
      act: (b) => b.add(const SpendBreakdownDrilledInto(_catNode)),
      verify: (b) {
        expect(b.state.categoryId, 'cat-groceries');
        expect(b.state.level, SpendLevel.merchants);
        expect(b.state.breakdown?.level, SpendLevel.merchants);
      },
    );

    blocTest<SpendBreakdownBloc, SpendBreakdownState>(
      'STANDARD drilling a merchant shows the upsell and does not drill',
      build: () {
        final reports = _FakeReports();
        return SpendBreakdownBloc(
          reports: reports,
          profile: _FakeProfile('STANDARD'),
        );
      },
      seed: () => const SpendBreakdownState(
        status: SpendBreakdownStatus.success,
        isPremium: false,
        categoryId: 'cat-groceries',
        categoryName: 'Groceries',
      ),
      act: (b) => b.add(const SpendBreakdownDrilledInto(_merchantNode)),
      verify: (b) {
        expect(b.state.showUpsell, isTrue);
        expect(b.state.merchantId, isNull); // did not descend
        expect(b.state.level, SpendLevel.merchants);
      },
    );

    blocTest<SpendBreakdownBloc, SpendBreakdownState>(
      'PREMIUM drilling a merchant descends to the item-category level',
      build: _bloc,
      seed: () => const SpendBreakdownState(
        status: SpendBreakdownStatus.success,
        isPremium: true,
        categoryId: 'cat-groceries',
        categoryName: 'Groceries',
      ),
      act: (b) => b.add(const SpendBreakdownDrilledInto(_merchantNode)),
      verify: (b) {
        expect(b.state.merchantId, 'm1');
        expect(b.state.level, SpendLevel.itemCategories);
      },
    );

    blocTest<SpendBreakdownBloc, SpendBreakdownState>(
      'reload re-fetches the current level without resetting the drill path or filters',
      build: _bloc,
      seed: () => const SpendBreakdownState(
        status: SpendBreakdownStatus.failure,
        isPremium: true,
        categoryId: 'cat-groceries',
        categoryName: 'Groceries',
      ),
      act: (b) => b.add(const SpendBreakdownReloaded()),
      verify: (b) {
        expect(b.state.categoryId, 'cat-groceries'); // drill path preserved
        expect(b.state.level, SpendLevel.merchants);
        expect(b.state.breakdown?.level, SpendLevel.merchants);
      },
    );

    blocTest<SpendBreakdownBloc, SpendBreakdownState>(
      'defaults to All regions when the profile has no home region',
      build: () => SpendBreakdownBloc(
        reports: _FakeReports(),
        profile: _FakeProfile('PREMIUM', regionCode: ''),
      ),
      act: (b) => b.add(const SpendBreakdownStarted()),
      verify: (b) => expect(b.state.allRegions, isTrue),
    );

    blocTest<SpendBreakdownBloc, SpendBreakdownState>(
      'tapping the root crumb resets to the category level',
      build: _bloc,
      seed: () => const SpendBreakdownState(
        status: SpendBreakdownStatus.success,
        isPremium: true,
        categoryId: 'cat-groceries',
        merchantId: 'm1',
      ),
      act: (b) => b.add(const SpendBreakdownCrumbTapped(0)),
      verify: (b) {
        expect(b.state.categoryId, isNull);
        expect(b.state.merchantId, isNull);
        expect(b.state.level, SpendLevel.categories);
      },
    );
  });
}
