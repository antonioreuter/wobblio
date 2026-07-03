import 'package:wobblio/core/budgets/budget.dart';

/// Fields for `POST /budgets`. `categoryId`/`memberUserId` are only meaningful
/// for their matching `scope` — see `BudgetService.validateNewBudget` on the
/// backend. Mobile's create form (18d) only ever sends `TOTAL`/`CATEGORY`.
class NewBudget {
  const NewBudget({
    required this.scope,
    this.categoryId,
    this.memberUserId,
    required this.amount,
    required this.period,
  });

  final String scope;
  final String? categoryId;
  final String? memberUserId;
  final double amount;
  final String period;
}

/// A partial edit to one budget — mirrors the backend's `BudgetPatch`
/// (`PATCH /budgets/{id}`, only set fields are sent).
class BudgetPatch {
  const BudgetPatch({this.amount, this.period});

  final double? amount;
  final String? period;
}

/// Port: the caller's budgets (18d). Budget creation/edit is Premium-gated
/// (or, for a household member who isn't the owner, always 403 regardless of
/// scope — see `BudgetService.authorizeCreate`) — a 403 surfaces as an
/// [ApiException] with `statusCode: 403`, which callers must catch explicitly.
/// Concrete adapter lives in `infrastructure/adapters/`.
abstract class IBudgetRepository {
  Future<List<Budget>> list();

  Future<Budget> create(NewBudget budget);

  Future<void> update(String id, BudgetPatch patch);

  Future<void> remove(String id);
}
