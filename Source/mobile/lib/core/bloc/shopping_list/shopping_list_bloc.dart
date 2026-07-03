import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/lists/optimization_result.dart';
import 'package:wobblio/core/lists/shopping_list_detail.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/shopping_list_repository.dart';

part 'shopping_list_event.dart';
part 'shopping_list_state.dart';

/// Owns the Shopping List screen (18c): loads the caller's first active list,
/// and — for Premium accounts only — the split-route optimizer's store
/// grouping, merged with the live item list by `productId` (the optimizer
/// has no item id — see [ShoppingListState.storeGroups]). Degrades
/// gracefully to a flat checklist for STANDARD accounts or when the
/// optimizer 403s/fails. Widgets stay logic-free
/// (`.claude/rules/flutter-architecture-guard.md`).
class ShoppingListBloc extends Bloc<ShoppingListEvent, ShoppingListState> {
  ShoppingListBloc({
    required IShoppingListRepository lists,
    required IProfileRepository profile,
  })  : _lists = lists,
        _profile = profile,
        super(const ShoppingListState()) {
    on<ShoppingListStarted>(_onStarted);
    on<ShoppingListRefreshed>(_onRefreshed);
    on<ShoppingListCreateRequested>(_onCreate);
    on<ShoppingListItemAdded>(_onItemAdded);
    on<ShoppingListItemToggled>(_onItemToggled);
    on<ShoppingListItemRemoved>(_onItemRemoved);
  }

  final IShoppingListRepository _lists;
  final IProfileRepository _profile;

  Future<void> _onStarted(
    ShoppingListStarted event,
    Emitter<ShoppingListState> emit,
  ) async {
    emit(state.copyWith(status: ShoppingListStatus.loading));
    await _load(emit);
  }

  Future<void> _onRefreshed(
    ShoppingListRefreshed event,
    Emitter<ShoppingListState> emit,
  ) async {
    await _load(emit);
  }

  Future<void> _load(Emitter<ShoppingListState> emit) async {
    final isPremium = await _safeIsPremium();
    try {
      final summaries = await _lists.list();
      if (summaries.isEmpty) {
        emit(state.copyWith(
            status: ShoppingListStatus.empty, isPremium: isPremium,),);
        return;
      }
      await _loadDetail(summaries.first.id, isPremium, emit);
    } catch (_) {
      emit(state.copyWith(status: ShoppingListStatus.failure));
    }
  }

  Future<void> _loadDetail(
    String listId,
    bool isPremium,
    Emitter<ShoppingListState> emit,
  ) async {
    final detail = await _lists.getDetail(listId);
    final optimization = isPremium ? await _safeOptimize(listId) : null;
    emit(
      state.copyWith(
        status: ShoppingListStatus.ready,
        list: detail,
        isPremium: isPremium,
        optimization: optimization,
      ),
    );
  }

  Future<void> _onCreate(
    ShoppingListCreateRequested event,
    Emitter<ShoppingListState> emit,
  ) async {
    emit(state.copyWith(notice: null));
    try {
      final id = await _lists.create(event.name, event.categoryId);
      await _loadDetail(id, state.isPremium, emit);
    } catch (_) {
      emit(state.copyWith(
          notice: 'Couldn’t create that list — please try again.',),);
    }
  }

  Future<void> _onItemAdded(
    ShoppingListItemAdded event,
    Emitter<ShoppingListState> emit,
  ) async {
    final list = state.list;
    if (list == null) return;
    emit(state.copyWith(notice: null));
    try {
      await _lists.addItem(list.id, event.freeText);
      await _loadDetail(list.id, state.isPremium, emit);
    } catch (_) {
      emit(
          state.copyWith(notice: 'Couldn’t add that item — please try again.'),);
    }
  }

  // Reverts only [itemId]'s own field against the *current* `state.list` at
  // failure time (not a snapshot captured at handler entry) — flutter_bloc
  // processes events concurrently by default, so a slow failure here must not
  // clobber a different item's already-applied, possibly-already-succeeded
  // edit from a handler that ran (and completed) in between.
  void _revertItem(Emitter<ShoppingListState> emit, ShoppingListItem original,
      String notice,) {
    final current = state.list;
    if (current == null) return;
    final index = current.items.indexWhere((i) => i.id == original.id);
    final revertedItems = [...current.items];
    if (index == -1) {
      revertedItems.add(original); // e.g. reverting a failed removal
    } else {
      revertedItems[index] = original; // e.g. reverting a failed toggle
    }
    emit(state.copyWith(
        list: _withItems(current, revertedItems), notice: notice,),);
  }

  Future<void> _onItemToggled(
    ShoppingListItemToggled event,
    Emitter<ShoppingListState> emit,
  ) async {
    final list = state.list;
    if (list == null) return;
    final index = list.items.indexWhere((i) => i.id == event.itemId);
    if (index == -1) return;
    final item = list.items[index];
    final toggled = ShoppingListItem(
      id: item.id,
      freeText: item.freeText,
      productId: item.productId,
      checked: !item.checked,
      quantity: item.quantity,
      position: item.position,
      updatedAt: item.updatedAt,
    );
    final optimisticItems = [...list.items];
    optimisticItems[index] = toggled;
    emit(state.copyWith(list: _withItems(list, optimisticItems), notice: null));
    try {
      await _lists.updateItem(
          list.id, item.id, ShoppingListItemPatch(checked: toggled.checked),);
    } catch (_) {
      _revertItem(emit, item, 'Couldn’t update that item — please try again.');
    }
  }

  Future<void> _onItemRemoved(
    ShoppingListItemRemoved event,
    Emitter<ShoppingListState> emit,
  ) async {
    final list = state.list;
    if (list == null) return;
    final index = list.items.indexWhere((i) => i.id == event.itemId);
    if (index == -1) return;
    final item = list.items[index];
    emit(
      state.copyWith(
        list: _withItems(
            list, list.items.where((i) => i.id != event.itemId).toList(),),
        notice: null,
      ),
    );
    try {
      await _lists.removeItem(list.id, event.itemId);
    } catch (_) {
      _revertItem(emit, item, 'Couldn’t remove that item — please try again.');
    }
  }

  ShoppingListDetail _withItems(
          ShoppingListDetail list, List<ShoppingListItem> items,) =>
      ShoppingListDetail(
        id: list.id,
        name: list.name,
        categoryId: list.categoryId,
        regionCode: list.regionCode,
        countryCode: list.countryCode,
        isActive: list.isActive,
        createdAt: list.createdAt,
        completedAt: list.completedAt,
        items: items,
      );

  Future<bool> _safeIsPremium() async {
    try {
      final profile = await _profile.fetchProfile();
      return profile.role != 'STANDARD';
    } catch (_) {
      return false; // fail closed — flat checklist is always a safe fallback
    }
  }

  /// Attempts the (Premium-only) split-route optimizer. A 403
  /// ([ApiException.statusCode] == 403) or any other failure falls back to
  /// `null` — the flat-checklist state — rather than failing the whole load.
  Future<OptimizationResult?> _safeOptimize(String listId) async {
    try {
      return await _lists.optimize(listId);
    } catch (_) {
      return null;
    }
  }
}
