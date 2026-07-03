part of 'budget_bloc.dart';

sealed class BudgetEvent extends Equatable {
  const BudgetEvent();

  @override
  List<Object?> get props => [];
}

/// First load: resolve premium status client-side, then (Premium only) fetch
/// budgets + category names.
class BudgetsStarted extends BudgetEvent {
  const BudgetsStarted();
}

/// Pull-to-refresh: same as [BudgetsStarted] but doesn't reset to `loading`
/// first.
class BudgetsRefreshed extends BudgetEvent {
  const BudgetsRefreshed();
}

/// "New budget" dialog submitted. [categoryId] is required (and only
/// meaningful) for `scope == 'CATEGORY'`. v1's create form only ever sends
/// `TOTAL`/`CATEGORY` — `MEMBER`/`HOUSEHOLD` have no mobile household picker
/// yet.
class BudgetCreateRequested extends BudgetEvent {
  const BudgetCreateRequested({
    required this.scope,
    this.categoryId,
    required this.amount,
    required this.period,
  });

  final String scope;
  final String? categoryId;
  final double amount;
  final String period;

  @override
  List<Object?> get props => [scope, categoryId, amount, period];
}

/// Edit dialog submitted for an existing `TOTAL`/`CATEGORY` budget.
class BudgetUpdateRequested extends BudgetEvent {
  const BudgetUpdateRequested(this.id, {this.amount, this.period});

  final String id;
  final double? amount;
  final String? period;

  @override
  List<Object?> get props => [id, amount, period];
}

/// Delete confirmed for an existing `TOTAL`/`CATEGORY` budget.
class BudgetDeleteRequested extends BudgetEvent {
  const BudgetDeleteRequested(this.id);

  final String id;

  @override
  List<Object?> get props => [id];
}
