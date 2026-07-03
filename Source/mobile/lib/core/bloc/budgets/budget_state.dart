part of 'budget_bloc.dart';

enum BudgetStatus { loading, ready, empty, forbidden, failure }

/// One row on the Budgets screen — a [Budget] plus its computed display
/// fields, so the widget layer never derives percentages or labels itself.
class BudgetRowView extends Equatable {
  const BudgetRowView({
    required this.budget,
    required this.categoryLabel,
    required this.progressPct,
    required this.overCap,
  });

  final Budget budget;
  final String categoryLabel;
  final double progressPct;
  final bool overCap;

  String get id => budget.id;
  bool get isEditable => budget.isEditable;

  @override
  List<Object?> get props => [budget, categoryLabel, progressPct, overCap];
}

/// Single immutable Budgets state. [status] `forbidden` means "non-premium —
/// show the upsell card instead of the list"; it is distinct from `failure`
/// (a load error, retryable). [categoryNames] backs [BudgetRowView
/// .categoryLabel] for `CATEGORY`-scope budgets.
class BudgetState extends Equatable {
  const BudgetState({
    this.status = BudgetStatus.loading,
    this.budgets = const [],
    this.categoryNames = const {},
    this.isPremium = false,
    this.notice,
  });

  final BudgetStatus status;
  final List<Budget> budgets;
  final Map<String, String> categoryNames;
  final bool isPremium;
  final String? notice;

  List<BudgetRowView> get rows => [for (final b in budgets) _rowFor(b)];

  bool get hasOverCapBudget => rows.any((r) => r.overCap);

  BudgetRowView _rowFor(Budget b) => BudgetRowView(
        budget: b,
        categoryLabel: _labelFor(b),
        progressPct: b.amount > 0
            ? (b.accumulated / b.amount * 100).clamp(0, 999).toDouble()
            : 0,
        overCap: b.accumulated > b.amount,
      );

  // MEMBER/HOUSEHOLD have no mobile household port to resolve a real name
  // from — generic fallback labels per the 18d scope decision.
  String _labelFor(Budget b) => switch (b.scope) {
        'TOTAL' => 'Total spending',
        'CATEGORY' => categoryNames[b.categoryId] ?? 'Category',
        'MEMBER' => 'Household member budget',
        'HOUSEHOLD' => 'Household budget',
        _ => 'Budget',
      };

  BudgetState copyWith({
    BudgetStatus? status,
    List<Budget>? budgets,
    Map<String, String>? categoryNames,
    bool? isPremium,
    // notice is nullable-with-clear, so use an explicit sentinel.
    Object? notice = _unset,
  }) {
    return BudgetState(
      status: status ?? this.status,
      budgets: budgets ?? this.budgets,
      categoryNames: categoryNames ?? this.categoryNames,
      isPremium: isPremium ?? this.isPremium,
      notice: notice == _unset ? this.notice : notice as String?,
    );
  }

  @override
  List<Object?> get props =>
      [status, budgets, categoryNames, isPremium, notice];
}

const Object _unset = Object();
