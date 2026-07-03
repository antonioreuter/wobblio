import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/budgets/budget.dart';
import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/budget_repository.dart';
import 'package:wobblio/core/ports/profile_repository.dart';
import 'package:wobblio/core/ports/reference_repository.dart';

part 'budget_event.dart';
part 'budget_state.dart';

/// Owns the Budgets screen (18d): Premium-only feature — a non-premium
/// account never calls `GET /budgets` (the backend doesn't gate that route,
/// so the "forbidden" screen state is decided client-side from the caller's
/// role, mirroring [ShoppingListBloc]'s `_safeIsPremium` fail-closed pattern)
/// and instead sees the upsell card. A 403 encountered mid-session on a
/// mutation (e.g. a household member who isn't the owner — see
/// `BudgetService.authorizeCreate`) surfaces as a notice rather than
/// collapsing the whole screen to `forbidden`, since existing budgets are
/// still valid to display. Widgets stay logic-free
/// (`.claude/rules/flutter-architecture-guard.md`).
class BudgetBloc extends Bloc<BudgetEvent, BudgetState> {
  BudgetBloc({
    required IBudgetRepository budgets,
    required IReferenceRepository reference,
    required IProfileRepository profile,
  })  : _budgets = budgets,
        _reference = reference,
        _profile = profile,
        super(const BudgetState()) {
    on<BudgetsStarted>(_onStarted);
    on<BudgetsRefreshed>(_onRefreshed);
    on<BudgetCreateRequested>(_onCreate);
    on<BudgetUpdateRequested>(_onUpdate);
    on<BudgetDeleteRequested>(_onDelete);
  }

  final IBudgetRepository _budgets;
  final IReferenceRepository _reference;
  final IProfileRepository _profile;

  Future<void> _onStarted(
      BudgetsStarted event, Emitter<BudgetState> emit,) async {
    emit(state.copyWith(status: BudgetStatus.loading));
    await _load(emit);
  }

  Future<void> _onRefreshed(
      BudgetsRefreshed event, Emitter<BudgetState> emit,) async {
    await _load(emit);
  }

  Future<void> _load(Emitter<BudgetState> emit) async {
    final isPremium = await _safeIsPremium();
    final categoryNames = await _safeCategoryNames();
    if (!isPremium) {
      emit(
        state.copyWith(
          status: BudgetStatus.forbidden,
          isPremium: false,
          categoryNames: categoryNames,
          budgets: const [],
        ),
      );
      return;
    }
    try {
      final budgets = await _budgets.list();
      emit(
        state.copyWith(
          status: budgets.isEmpty ? BudgetStatus.empty : BudgetStatus.ready,
          budgets: budgets,
          isPremium: true,
          categoryNames: categoryNames,
        ),
      );
    } catch (_) {
      emit(state.copyWith(
          status: BudgetStatus.failure,
          isPremium: true,
          categoryNames: categoryNames,),);
    }
  }

  Future<void> _onCreate(
      BudgetCreateRequested event, Emitter<BudgetState> emit,) async {
    emit(state.copyWith(notice: null));
    try {
      await _budgets.create(
        NewBudget(
            scope: event.scope,
            categoryId: event.categoryId,
            amount: event.amount,
            period: event.period,),
      );
      await _load(emit);
    } on ApiException catch (e) {
      emit(state.copyWith(notice: _noticeFor(e, 'create')));
    } catch (_) {
      emit(state.copyWith(
          notice: 'Couldn’t create that budget — please try again.',),);
    }
  }

  Future<void> _onUpdate(
      BudgetUpdateRequested event, Emitter<BudgetState> emit,) async {
    emit(state.copyWith(notice: null));
    try {
      await _budgets.update(
          event.id, BudgetPatch(amount: event.amount, period: event.period),);
      await _load(emit);
    } on ApiException catch (e) {
      emit(state.copyWith(notice: _noticeFor(e, 'update')));
    } catch (_) {
      emit(state.copyWith(
          notice: 'Couldn’t update that budget — please try again.',),);
    }
  }

  Future<void> _onDelete(
      BudgetDeleteRequested event, Emitter<BudgetState> emit,) async {
    emit(state.copyWith(notice: null));
    try {
      await _budgets.remove(event.id);
      await _load(emit);
    } on ApiException catch (e) {
      emit(state.copyWith(notice: _noticeFor(e, 'delete')));
    } catch (_) {
      emit(state.copyWith(
          notice: 'Couldn’t delete that budget — please try again.',),);
    }
  }

  String _noticeFor(ApiException e, String action) => switch (e.statusCode) {
        403 =>
          'Only Premium accounts or the household owner can manage budgets.',
        409 => 'You’ve reached the 10-budget limit — remove one first.',
        400 => 'Couldn’t $action that budget — check the amount and try again.',
        _ => 'Couldn’t $action that budget — please try again.',
      };

  Future<bool> _safeIsPremium() async {
    try {
      final profile = await _profile.fetchProfile();
      return profile.role != 'STANDARD';
    } catch (_) {
      return false; // fail closed — the upsell card is always a safe fallback
    }
  }

  Future<Map<String, String>> _safeCategoryNames() async {
    try {
      final categories = await _reference.fetchCategories();
      return {for (final c in categories) c.id: c.name};
    } catch (_) {
      return const {};
    }
  }
}
