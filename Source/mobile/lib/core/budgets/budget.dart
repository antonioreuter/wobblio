import 'package:equatable/equatable.dart';

/// Mirrors the backend's `BudgetView` (`GET/POST /budgets`) field-for-field —
/// see `specs/mvp/18-mobile-navigation-and-lists/18d-budgets.md`.
class Budget extends Equatable {
  const Budget({
    required this.id,
    required this.scope,
    required this.categoryId,
    required this.memberUserId,
    required this.amount,
    required this.period,
    required this.accumulated,
    required this.alert85Fired,
    required this.alert100Fired,
    required this.alert85At,
    required this.alert100At,
    required this.cycleStart,
  });

  final String id;
  final String scope; // 'TOTAL' | 'CATEGORY' | 'MEMBER' | 'HOUSEHOLD'
  final String? categoryId;
  final String? memberUserId;
  final double amount;
  final String period; // 'DAY' | 'WEEK' | 'MONTH'
  final double accumulated;
  final bool alert85Fired;
  final bool alert100Fired;
  final String? alert85At;
  final String? alert100At;
  final String cycleStart;

  /// `MEMBER`/`HOUSEHOLD` budgets need a household picker mobile doesn't have
  /// yet — those rows render read-only (no edit/delete affordance) with a
  /// generic label instead. See the 18d spec's scope decisions.
  bool get isEditable => scope == 'TOTAL' || scope == 'CATEGORY';

  @override
  List<Object?> get props => [
        id,
        scope,
        categoryId,
        memberUserId,
        amount,
        period,
        accumulated,
        alert85Fired,
        alert100Fired,
        alert85At,
        alert100At,
        cycleStart,
      ];
}
