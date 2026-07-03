import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/auth/user_profile.dart';
import 'package:wobblio/core/bloc/budgets/budget_bloc.dart';
import 'package:wobblio/core/budgets/budget.dart';
import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/budget_repository.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/reference_repository.dart';
import 'package:wobblio/core/reference/category.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
Budget _budget({
  String id = 'b1',
  String scope = 'TOTAL',
  String? categoryId,
  String? memberUserId,
  double amount = 100,
  double accumulated = 20,
  String period = 'MONTH',
}) =>
    Budget(
      id: id,
      scope: scope,
      categoryId: categoryId,
      memberUserId: memberUserId,
      amount: amount,
      period: period,
      accumulated: accumulated,
      alert85Fired: false,
      alert100Fired: false,
      alert85At: null,
      alert100At: null,
      cycleStart: '2026-07-01',
    );

UserProfile _profile(String role) =>
    UserProfile(onboarded: true, fullName: 'Anna', role: role, status: 'ACTIVE');

// ── Hand-rolled fakes ─────────────────────────────────────────────────────────
class _FakeBudgets implements IBudgetRepository {
  _FakeBudgets({
    List<Budget>? budgets,
    this.createThrows,
    this.updateThrows,
    this.removeThrows,
  }) : _budgets = List.of(budgets ?? [_budget()]);

  // Mutable — create()/remove() below mimic the backend's persisted state so
  // a subsequent list() (as `_load` always issues after a mutation) reflects
  // the change, the same way the real HTTP adapter would.
  final List<Budget> _budgets;
  final ApiException? createThrows;
  final ApiException? updateThrows;
  final ApiException? removeThrows;

  NewBudget? createdWith;
  final List<(String, BudgetPatch)> updated = [];
  final List<String> removed = [];

  @override
  Future<List<Budget>> list() async => _budgets;

  @override
  Future<Budget> create(NewBudget budget) async {
    createdWith = budget;
    if (createThrows != null) throw createThrows!;
    final created = _budget(id: 'b-new', scope: budget.scope, categoryId: budget.categoryId, amount: budget.amount, period: budget.period);
    _budgets.add(created);
    return created;
  }

  @override
  Future<void> update(String id, BudgetPatch patch) async {
    updated.add((id, patch));
    if (updateThrows != null) throw updateThrows!;
  }

  @override
  Future<void> remove(String id) async {
    removed.add(id);
    if (removeThrows != null) throw removeThrows!;
    _budgets.removeWhere((b) => b.id == id);
  }
}

class _FakeReference implements IReferenceRepository {
  _FakeReference({this.categories = const [Category(id: 'cat-groceries', name: 'Groceries')]});
  final List<Category> categories;

  @override
  Future<List<Category>> fetchCategories() async => categories;
}

class _FakeProfile implements IProfileRepository {
  _FakeProfile(this.role, {this.fails = false});
  final String role;
  final bool fails;

  @override
  Future<UserProfile> fetchProfile() async {
    if (fails) throw Exception('boom');
    return _profile(role);
  }
}

BudgetBloc _bloc({
  IBudgetRepository? budgets,
  IReferenceRepository? reference,
  String role = 'PREMIUM',
  bool profileFails = false,
}) =>
    BudgetBloc(
      budgets: budgets ?? _FakeBudgets(),
      reference: reference ?? _FakeReference(),
      profile: _FakeProfile(role, fails: profileFails),
    );

void main() {
  group('BudgetBloc', () {
    blocTest<BudgetBloc, BudgetState>(
      'PREMIUM with budgets → ready, rows carry computed progress',
      build: () => _bloc(budgets: _FakeBudgets(budgets: [_budget(amount: 100, accumulated: 20)])),
      act: (bloc) => bloc.add(const BudgetsStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.status, BudgetStatus.ready);
        expect(bloc.state.rows.single.progressPct, 20);
        expect(bloc.state.rows.single.overCap, isFalse);
      },
    );

    blocTest<BudgetBloc, BudgetState>(
      'PREMIUM with no budgets → empty',
      build: () => _bloc(budgets: _FakeBudgets(budgets: [])),
      act: (bloc) => bloc.add(const BudgetsStarted()),
      skip: 1,
      expect: () => [isA<BudgetState>().having((s) => s.status, 'status', BudgetStatus.empty)],
    );

    blocTest<BudgetBloc, BudgetState>(
      'STANDARD account never calls list() — forbidden, upsell state',
      build: () => _bloc(role: 'STANDARD'),
      act: (bloc) => bloc.add(const BudgetsStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.status, BudgetStatus.forbidden);
        expect(bloc.state.isPremium, isFalse);
        expect(bloc.state.budgets, isEmpty);
      },
    );

    blocTest<BudgetBloc, BudgetState>(
      'profile fetch failure fails closed to forbidden (safe upsell fallback)',
      build: () => _bloc(profileFails: true),
      act: (bloc) => bloc.add(const BudgetsStarted()),
      skip: 1,
      verify: (bloc) => expect(bloc.state.status, BudgetStatus.forbidden),
    );

    blocTest<BudgetBloc, BudgetState>(
      'load failure surfaces the retryable failure status',
      build: () => BudgetBloc(
        budgets: _ThrowingList(),
        reference: _FakeReference(),
        profile: _FakeProfile('PREMIUM'),
      ),
      act: (bloc) => bloc.add(const BudgetsStarted()),
      skip: 1,
      verify: (bloc) => expect(bloc.state.status, BudgetStatus.failure),
    );

    blocTest<BudgetBloc, BudgetState>(
      'CATEGORY budget resolves its display name via the loaded category map',
      build: () => _bloc(
        budgets: _FakeBudgets(budgets: [_budget(scope: 'CATEGORY', categoryId: 'cat-groceries')]),
        reference: _FakeReference(categories: const [Category(id: 'cat-groceries', name: 'Groceries')]),
      ),
      act: (bloc) => bloc.add(const BudgetsStarted()),
      skip: 1,
      verify: (bloc) => expect(bloc.state.rows.single.categoryLabel, 'Groceries'),
    );

    blocTest<BudgetBloc, BudgetState>(
      'MEMBER/HOUSEHOLD budgets get a generic read-only label, no edit affordance',
      build: () => _bloc(
        budgets: _FakeBudgets(
          budgets: [
            _budget(id: 'm1', scope: 'MEMBER', memberUserId: 'u2'),
            _budget(id: 'h1', scope: 'HOUSEHOLD'),
          ],
        ),
      ),
      act: (bloc) => bloc.add(const BudgetsStarted()),
      skip: 1,
      verify: (bloc) {
        final member = bloc.state.rows.firstWhere((r) => r.id == 'm1');
        final household = bloc.state.rows.firstWhere((r) => r.id == 'h1');
        expect(member.categoryLabel, 'Household member budget');
        expect(member.isEditable, isFalse);
        expect(household.categoryLabel, 'Household budget');
        expect(household.isEditable, isFalse);
      },
    );

    blocTest<BudgetBloc, BudgetState>(
      'a budget over its cap is flagged overCap',
      build: () => _bloc(budgets: _FakeBudgets(budgets: [_budget(amount: 100, accumulated: 150)])),
      act: (bloc) => bloc.add(const BudgetsStarted()),
      skip: 1,
      verify: (bloc) => expect(bloc.state.rows.single.overCap, isTrue),
    );

    blocTest<BudgetBloc, BudgetState>(
      'create success reloads the list',
      build: () => _bloc(budgets: _FakeBudgets(budgets: [])),
      act: (bloc) async {
        bloc.add(const BudgetsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const BudgetCreateRequested(scope: 'TOTAL', amount: 50, period: 'MONTH'));
      },
      skip: 2,
      verify: (bloc) => expect(bloc.state.status, BudgetStatus.ready),
    );

    blocTest<BudgetBloc, BudgetState>(
      'create failure (409 limit) surfaces a notice, no status change',
      build: () => _bloc(
        budgets: _FakeBudgets(
          budgets: [_budget()],
          createThrows: const ApiException('limit', statusCode: 409),
        ),
      ),
      act: (bloc) async {
        bloc.add(const BudgetsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const BudgetCreateRequested(scope: 'TOTAL', amount: 50, period: 'MONTH'));
      },
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.status, BudgetStatus.ready);
        expect(bloc.state.notice, contains('limit'));
      },
    );

    blocTest<BudgetBloc, BudgetState>(
      'create failure (400 invalid) surfaces a notice',
      build: () => _bloc(
        budgets: _FakeBudgets(
          budgets: [_budget()],
          createThrows: const ApiException('invalid', statusCode: 400),
        ),
      ),
      act: (bloc) async {
        bloc.add(const BudgetsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const BudgetCreateRequested(scope: 'TOTAL', amount: 50, period: 'MONTH'));
      },
      skip: 1,
      verify: (bloc) => expect(bloc.state.notice, isNotNull),
    );

    test(
      'create failure twice in a row still notices both times (notice reset before retry)',
      () async {
        final bloc = _bloc(
          budgets: _FakeBudgets(
            budgets: [_budget()],
            createThrows: const ApiException('invalid', statusCode: 400),
          ),
        );
        final notices = <String?>[];
        final sub = bloc.stream.listen((s) => notices.add(s.notice));
        bloc.add(const BudgetsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const BudgetCreateRequested(scope: 'TOTAL', amount: 50, period: 'MONTH'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const BudgetCreateRequested(scope: 'TOTAL', amount: 50, period: 'MONTH'));
        await Future<void>.delayed(const Duration(milliseconds: 10));

        final failureCount = notices.where((n) => n != null).length;
        expect(failureCount, 2);
        await sub.cancel();
        await bloc.close();
      },
    );

    blocTest<BudgetBloc, BudgetState>(
      'update reloads with the new values',
      build: () => _bloc(budgets: _FakeBudgets(budgets: [_budget(amount: 100)])),
      act: (bloc) async {
        bloc.add(const BudgetsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const BudgetUpdateRequested('b1', amount: 200));
      },
      skip: 2,
      verify: (bloc) => expect(bloc.state.status, BudgetStatus.ready),
    );

    blocTest<BudgetBloc, BudgetState>(
      'update failure (400 invalid) surfaces a notice, budget list unchanged',
      build: () => _bloc(
        budgets: _FakeBudgets(
          budgets: [_budget(amount: 100)],
          updateThrows: const ApiException('invalid', statusCode: 400),
        ),
      ),
      act: (bloc) async {
        bloc.add(const BudgetsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const BudgetUpdateRequested('b1', amount: -5));
      },
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.status, BudgetStatus.ready);
        expect(bloc.state.notice, isNotNull);
      },
    );

    blocTest<BudgetBloc, BudgetState>(
      'delete removes the budget and reloads to empty',
      build: () => _bloc(budgets: _FakeBudgets(budgets: [_budget()])),
      act: (bloc) async {
        bloc.add(const BudgetsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const BudgetDeleteRequested('b1'));
      },
      skip: 2,
      verify: (bloc) => expect(bloc.state.status, BudgetStatus.empty),
    );

    blocTest<BudgetBloc, BudgetState>(
      'delete failure surfaces a generic notice',
      build: () => _bloc(
        budgets: _FakeBudgets(
          budgets: [_budget()],
          removeThrows: const ApiException('boom', statusCode: 500),
        ),
      ),
      act: (bloc) async {
        bloc.add(const BudgetsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const BudgetDeleteRequested('b1'));
      },
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.status, BudgetStatus.ready);
        expect(bloc.state.notice, isNotNull);
      },
    );

    blocTest<BudgetBloc, BudgetState>(
      '403 on create surfaces a notice without collapsing the whole screen to forbidden',
      build: () => _bloc(
        budgets: _FakeBudgets(
          budgets: [_budget()],
          createThrows: const ApiException('not owner', statusCode: 403),
        ),
      ),
      act: (bloc) async {
        bloc.add(const BudgetsStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const BudgetCreateRequested(scope: 'TOTAL', amount: 50, period: 'MONTH'));
      },
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.status, BudgetStatus.ready);
        expect(bloc.state.notice, isNotNull);
      },
    );
  });
}

class _ThrowingList implements IBudgetRepository {
  @override
  Future<List<Budget>> list() async => throw Exception('boom');

  @override
  Future<Budget> create(NewBudget budget) async => throw UnimplementedError();

  @override
  Future<void> update(String id, BudgetPatch patch) async => throw UnimplementedError();

  @override
  Future<void> remove(String id) async => throw UnimplementedError();
}
