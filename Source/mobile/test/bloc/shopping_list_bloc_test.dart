import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/auth/user_profile.dart';
import 'package:wobblio/core/bloc/shopping_list/shopping_list_bloc.dart';
import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/lists/optimization_result.dart';
import 'package:wobblio/core/lists/shopping_list_detail.dart';
import 'package:wobblio/core/lists/shopping_list_summary.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/shopping_list_repository.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
ShoppingListItem _item(String id, {String? productId, bool checked = false, double quantity = 1}) =>
    ShoppingListItem(
      id: id,
      freeText: 'Item $id',
      productId: productId,
      checked: checked,
      quantity: quantity,
      position: 0,
      updatedAt: '2026-06-30T00:00:00Z',
    );

ShoppingListDetail _detail({List<ShoppingListItem>? items}) => ShoppingListDetail(
      id: 'list-1',
      name: 'Groceries',
      categoryId: 'cat-groceries',
      regionCode: null,
      countryCode: null,
      isActive: true,
      createdAt: '2026-06-30T00:00:00Z',
      completedAt: null,
      items: items ?? [_item('i1', productId: 'p1'), _item('i2')],
    );

OptimizationResult _optimized() => const OptimizationResult(
      optimized: true,
      baseline: OptimizerBaseline(merchantId: 'm-baseline', name: 'Jumbo', total: 20),
      totalExpectedSaving: 4.2,
      stores: [
        StoreSubList(
          merchantId: 'm-jumbo',
          name: 'Jumbo',
          isPrimary: true,
          subtotal: 1.89, // must equal the sum of `lines` below — see 18-00-handoff post-review fixes
          lines: [
            StoreLine(
              productId: 'p1',
              displayName: 'Bananen',
              expectedPrice: 1.89,
              quantity: 1,
              lineTotal: 1.89,
              observationCount: 5,
              lastObservedOn: '2026-06-28',
              confidence: 'high',
            ),
          ],
        ),
      ],
      unresolvedItems: [],
      reason: null,
    );

UserProfile _profile(String role) =>
    UserProfile(onboarded: true, fullName: 'Anna', role: role, status: 'ACTIVE');

// ── Hand-rolled fakes ─────────────────────────────────────────────────────────
class _FakeLists implements IShoppingListRepository {
  _FakeLists({
    List<ShoppingListSummary>? summaries,
    ShoppingListDetail? detail,
    OptimizationResult? optimization,
    this.optimizeThrows403 = false,
    this.optimizeThrows = false,
    this.failUpdateForItemId,
    this.updateDelay = Duration.zero,
    this.addItemError = false,
  })  : _summaries = summaries ?? [const ShoppingListSummary(id: 'list-1', name: 'Groceries', categoryId: 'cat-groceries', itemCount: 2, createdAt: '2026-06-30T00:00:00Z')],
        _listDetail = detail ?? _detail(),
        _optimization = optimization;

  final List<ShoppingListSummary> _summaries;
  final ShoppingListDetail _listDetail;
  final OptimizationResult? _optimization;
  final bool optimizeThrows403;
  final bool optimizeThrows;
  // Item whose updateItem call fails (after `updateDelay`) — lets a test race
  // it against a different item's fast, succeeding mutation.
  final String? failUpdateForItemId;
  final Duration updateDelay;
  final bool addItemError;
  int optimizeCalls = 0;
  String? createdName;
  String? createdCategoryId;
  final List<String> addedItems = [];
  final List<(String, ShoppingListItemPatch)> patched = [];
  final List<String> removed = [];

  @override
  Future<List<ShoppingListSummary>> list() async => _summaries;

  @override
  Future<ShoppingListDetail> getDetail(String listId) async => _listDetail;

  @override
  Future<String> create(String name, String categoryId) async {
    createdName = name;
    createdCategoryId = categoryId;
    return 'list-new';
  }

  @override
  Future<String> addItem(String listId, String freeText, {String? productId, double quantity = 1}) async {
    addedItems.add(freeText);
    if (addItemError) throw Exception('boom');
    return 'item-new';
  }

  @override
  Future<void> updateItem(String listId, String itemId, ShoppingListItemPatch patch) async {
    patched.add((itemId, patch));
    if (itemId == failUpdateForItemId) {
      await Future<void>.delayed(updateDelay);
      throw Exception('boom');
    }
  }

  @override
  Future<void> removeItem(String listId, String itemId) async {
    removed.add(itemId);
  }

  @override
  Future<OptimizationResult> optimize(String listId, {List<String> excludedMerchantIds = const []}) async {
    optimizeCalls++;
    if (optimizeThrows403) throw const ApiException('Premium required', statusCode: 403);
    if (optimizeThrows) throw Exception('boom');
    return _optimization ?? _optimized();
  }
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

void main() {
  group('ShoppingListBloc', () {
    blocTest<ShoppingListBloc, ShoppingListState>(
      'empty list() → empty status',
      build: () => ShoppingListBloc(
        lists: _FakeLists(summaries: []),
        profile: _FakeProfile('STANDARD'),
      ),
      act: (bloc) => bloc.add(const ShoppingListStarted()),
      skip: 1,
      expect: () => [
        isA<ShoppingListState>().having((s) => s.status, 'status', ShoppingListStatus.empty),
      ],
    );

    blocTest<ShoppingListBloc, ShoppingListState>(
      'STANDARD account never calls optimize — flat checklist',
      build: () => ShoppingListBloc(lists: _FakeLists(), profile: _FakeProfile('STANDARD')),
      act: (bloc) => bloc.add(const ShoppingListStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.isPremium, isFalse);
        expect(bloc.state.showsSplitRouteBanner, isFalse);
        expect(bloc.state.storeGroups, isEmpty);
        expect(bloc.state.ungroupedRows.length, 2);
      },
    );

    blocTest<ShoppingListBloc, ShoppingListState>(
      'PREMIUM account merges the optimizer result by productId',
      build: () => ShoppingListBloc(lists: _FakeLists(), profile: _FakeProfile('PREMIUM')),
      act: (bloc) => bloc.add(const ShoppingListStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.isPremium, isTrue);
        expect(bloc.state.showsSplitRouteBanner, isTrue);
        expect(bloc.state.storeGroups, hasLength(1));
        expect(bloc.state.storeGroups.single.rows.single.itemId, 'i1');
        expect(bloc.state.storeGroups.single.rows.single.price, 1.89);
        // The unlinked item (no productId) stays ungrouped, not dropped.
        expect(bloc.state.ungroupedRows.map((r) => r.itemId), ['i2']);
        expect(bloc.state.estimatedTotal, 1.89);
      },
    );

    blocTest<ShoppingListBloc, ShoppingListState>(
      'PREMIUM account whose optimize call 403s falls back to a flat checklist',
      build: () => ShoppingListBloc(
        lists: _FakeLists(optimizeThrows403: true),
        profile: _FakeProfile('PREMIUM'),
      ),
      act: (bloc) => bloc.add(const ShoppingListStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.isPremium, isTrue);
        expect(bloc.state.showsSplitRouteBanner, isFalse);
        expect(bloc.state.storeGroups, isEmpty);
        expect(bloc.state.ungroupedRows.length, 2);
      },
    );

    blocTest<ShoppingListBloc, ShoppingListState>(
      'PREMIUM account whose optimize call fails generically also falls back',
      build: () => ShoppingListBloc(
        lists: _FakeLists(optimizeThrows: true),
        profile: _FakeProfile('PREMIUM'),
      ),
      act: (bloc) => bloc.add(const ShoppingListStarted()),
      skip: 1,
      verify: (bloc) => expect(bloc.state.storeGroups, isEmpty),
    );

    blocTest<ShoppingListBloc, ShoppingListState>(
      'profile fetch failure fails closed to STANDARD (no optimize call)',
      build: () => ShoppingListBloc(lists: _FakeLists(), profile: _FakeProfile('PREMIUM', fails: true)),
      act: (bloc) => bloc.add(const ShoppingListStarted()),
      skip: 1,
      verify: (bloc) => expect(bloc.state.isPremium, isFalse),
    );

    blocTest<ShoppingListBloc, ShoppingListState>(
      'create list on empty state loads the new list',
      build: () => ShoppingListBloc(lists: _FakeLists(summaries: []), profile: _FakeProfile('STANDARD')),
      act: (bloc) async {
        bloc.add(const ShoppingListStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ShoppingListCreateRequested('My list', 'cat-groceries'));
      },
      skip: 2,
      verify: (bloc) => expect(bloc.state.status, ShoppingListStatus.ready),
    );

    blocTest<ShoppingListBloc, ShoppingListState>(
      'toggling an item is optimistic and reverts on failure',
      build: () {
        final lists = _FakeLists();
        return ShoppingListBloc(lists: lists, profile: _FakeProfile('STANDARD'));
      },
      act: (bloc) async {
        bloc.add(const ShoppingListStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ShoppingListItemToggled('i1'));
      },
      skip: 1,
      verify: (bloc) {
        final row = bloc.state.ungroupedRows.firstWhere((r) => r.itemId == 'i1');
        expect(row.checked, isTrue);
      },
    );

    blocTest<ShoppingListBloc, ShoppingListState>(
      'removing an item drops it from the live list optimistically',
      build: () => ShoppingListBloc(lists: _FakeLists(), profile: _FakeProfile('STANDARD')),
      act: (bloc) async {
        bloc.add(const ShoppingListStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ShoppingListItemRemoved('i2'));
      },
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.ungroupedRows.map((r) => r.itemId), isNot(contains('i2')));
      },
    );

    test(
      'a slow-failing toggle reverts only its own item, not a concurrent, '
      'already-succeeded removal of a different item',
      () async {
        // flutter_bloc processes events concurrently by default — i1's
        // toggle fails after i2's removal has already succeeded. The revert
        // must not resurrect i2.
        final lists = _FakeLists(
          failUpdateForItemId: 'i1',
          updateDelay: const Duration(milliseconds: 20),
        );
        final bloc = ShoppingListBloc(lists: lists, profile: _FakeProfile('STANDARD'));
        bloc.add(const ShoppingListStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ShoppingListItemToggled('i1')); // slow, will fail
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ShoppingListItemRemoved('i2')); // fast, succeeds
        await Future<void>.delayed(const Duration(milliseconds: 40));

        final ids = bloc.state.ungroupedRows.map((r) => r.itemId).toList();
        expect(ids, isNot(contains('i2')), reason: 'i2 must stay removed');
        expect(
          bloc.state.ungroupedRows.firstWhere((r) => r.itemId == 'i1').checked,
          isFalse,
          reason: 'i1 must revert to its pre-toggle checked state',
        );
        await bloc.close();
      },
    );

    blocTest<ShoppingListBloc, ShoppingListState>(
      'removing a priced item recomputes the store-group subtotal, not the stale optimizer snapshot',
      build: () => ShoppingListBloc(lists: _FakeLists(), profile: _FakeProfile('PREMIUM')),
      act: (bloc) async {
        bloc.add(const ShoppingListStarted());
        await Future<void>.delayed(Duration.zero);
        // i1 (productId p1) is the only item priced by the optimizer fixture.
        bloc.add(const ShoppingListItemRemoved('i1'));
      },
      skip: 2,
      verify: (bloc) {
        // No rows left in the Jumbo group once its only priced item is gone.
        expect(bloc.state.storeGroups.every((g) => g.rows.isEmpty), isTrue);
        expect(bloc.state.estimatedTotal, 0);
      },
    );

    test(
      'add-item failure twice in a row still notices both times (notice reset before retry)',
      () async {
        final bloc = ShoppingListBloc(
          lists: _FakeLists(addItemError: true),
          profile: _FakeProfile('STANDARD'),
        );
        final notices = <String?>[];
        final sub = bloc.stream.listen((s) => notices.add(s.notice));
        bloc.add(const ShoppingListStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ShoppingListItemAdded('Bananen'));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ShoppingListItemAdded('Bananen')); // identical text, second failure
        await Future<void>.delayed(const Duration(milliseconds: 10));

        // Two failures, each preceded by a notice:null reset, so both are
        // individually observable — not deduped into a single emit.
        final failureCount = notices.where((n) => n != null).length;
        expect(failureCount, 2);
        await sub.cancel();
        await bloc.close();
      },
    );
  });
}
