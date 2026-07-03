import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/budgets/budget_bloc.dart';
import 'package:wobblio/core/budgets/budget.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/design_system/badge.dart';
import 'package:wobblio/ui/design_system/button.dart';
import 'package:wobblio/ui/design_system/glass_container.dart';
import 'package:wobblio/ui/design_system/input.dart';
import 'package:wobblio/ui/design_system/progress_bar.dart';
import 'package:wobblio/ui/design_system/tokens.dart';
import 'package:wobblio/ui/design_system/wobblio_header.dart';
import 'package:wobblio/ui/format.dart';

/// Budgets screen (18d): non-premium accounts see an upsell card instead of
/// the list; `TOTAL`/`CATEGORY` budgets are creatable/editable/deletable;
/// `MEMBER`/`HOUSEHOLD` budgets (no mobile household picker yet) render
/// read-only. See `specs/mvp/18-mobile-navigation-and-lists/18d-budgets.md`.
/// Not wired into any nav yet — pushed via `Navigator` from a later slice.
class BudgetsScreen extends StatelessWidget {
  const BudgetsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<BudgetBloc>(
      create: (_) => locator<BudgetBloc>()..add(const BudgetsStarted()),
      child: const _BudgetsView(),
    );
  }
}

class _BudgetsView extends StatelessWidget {
  const _BudgetsView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('budgets-screen'),
      backgroundColor: Colors.transparent,
      appBar: WobblioHeaderBar(
        title: 'Budgets',
        onBack: () => Navigator.of(context).maybePop(),
      ),
      body: SafeArea(
        child: BlocConsumer<BudgetBloc, BudgetState>(
          listenWhen: (prev, curr) =>
              curr.notice != null && prev.notice != curr.notice,
          listener: (context, state) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(state.notice!)));
          },
          builder: (context, state) => _buildBody(context, state),
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, BudgetState state) {
    if (state.status == BudgetStatus.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.status == BudgetStatus.failure) {
      return _RetryMessage(
          onRetry: () =>
              context.read<BudgetBloc>().add(const BudgetsStarted()),);
    }
    if (state.status == BudgetStatus.forbidden) {
      return const _UpsellCard();
    }
    return RefreshIndicator(
      onRefresh: () async =>
          context.read<BudgetBloc>().add(const BudgetsRefreshed()),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            sliver:
                SliverToBoxAdapter(child: _Header(count: state.budgets.length)),
          ),
          if (state.hasOverCapBudget)
            const SliverPadding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
              sliver: SliverToBoxAdapter(child: _OverCapBanner()),
            ),
          if (state.status == BudgetStatus.empty)
            const SliverFillRemaining(
                hasScrollBody: false, child: _EmptyState(),)
          else
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              sliver: SliverList.list(
                children: [
                  for (final row in state.rows)
                    _BudgetRow(row: row, categoryNames: state.categoryNames),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Budgets',
                  style: AppTypography.display(size: AppTypography.text2xl),),
              const SizedBox(height: 2),
              Text('$count active',
                  style: AppTypography.body(
                      size: AppTypography.textXs, color: AppColors.textMuted,),),
            ],
          ),
        ),
        WobblioButton(
          key: const Key('budgets-new'),
          label: 'New budget',
          variant: WobblioButtonVariant.outline,
          iconLeft: Icons.add,
          onPressed: () => _openCreateDialog(context),
        ),
      ],
    );
  }
}

class _OverCapBanner extends StatelessWidget {
  const _OverCapBanner();

  @override
  Widget build(BuildContext context) {
    return GlassContainer(
      padding: const EdgeInsets.all(15),
      borderColor: AppColors.dangerBorder,
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                color: AppColors.dangerGlow,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),),
            child: const Icon(Icons.warning_amber_rounded,
                size: 20, color: AppColors.danger,),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'One or more budgets are over their limit',
              style: AppTypography.body(
                  size: AppTypography.textSm,
                  weight: FontWeight.w700,
                  color: AppColors.danger,),
            ),
          ),
        ],
      ),
    );
  }
}

class _BudgetRow extends StatelessWidget {
  const _BudgetRow({required this.row, required this.categoryNames});

  final BudgetRowView row;
  final Map<String, String> categoryNames;

  @override
  Widget build(BuildContext context) {
    final budget = row.budget;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GlassContainer(
        key: Key('budget-row-${row.id}'),
        borderColor:
            row.overCap ? AppColors.dangerBorder : AppColors.glassBorder,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(row.categoryLabel,
                          style: AppTypography.body(
                              size: AppTypography.textMd,
                              weight: FontWeight.w700,),),
                      const SizedBox(height: 2),
                      Text(
                        '${_periodLabel(budget.period)} · ${formatMoney('EUR', budget.amount)}',
                        style: AppTypography.body(
                            size: AppTypography.textXs,
                            color: AppColors.textMuted,),
                      ),
                    ],
                  ),
                ),
                WobblioBadge(
                  label: budget.scope,
                  tone: row.overCap
                      ? WobblioBadgeTone.danger
                      : WobblioBadgeTone.primary,
                ),
                if (row.isEditable) ...[
                  IconButton(
                    key: Key('budget-edit-${row.id}'),
                    icon: const Icon(Icons.edit_outlined,
                        size: 18, color: AppColors.textMuted,),
                    onPressed: () =>
                        _openEditDialog(context, row, categoryNames),
                  ),
                  IconButton(
                    key: Key('budget-delete-${row.id}'),
                    icon: const Icon(Icons.delete_outline,
                        size: 18, color: AppColors.textMuted,),
                    onPressed: () => _confirmDelete(context, row.id),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 10),
            ProgressBar(value: row.progressPct),
            const SizedBox(height: 6),
            Text(
              '${formatMoney('EUR', budget.accumulated)} of ${formatMoney('EUR', budget.amount)}',
              style: AppTypography.body(
                size: AppTypography.textXs,
                color: row.overCap ? AppColors.danger : AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.savings_outlined,
                size: 48, color: AppColors.brand,),
            const SizedBox(height: 16),
            Text('No budgets yet',
                style: AppTypography.body(size: AppTypography.textMd),),
            const SizedBox(height: 16),
            WobblioButton(
              key: const Key('budgets-create-first'),
              label: 'Create a budget',
              onPressed: () => _openCreateDialog(context),
            ),
          ],
        ),
      ),
    );
  }
}

class _UpsellCard extends StatelessWidget {
  const _UpsellCard();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: GlassContainer(
          key: const Key('budgets-upsell'),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_outline, size: 40, color: AppColors.brand),
              const SizedBox(height: 12),
              Text(
                'Budgets are a Premium feature',
                style: AppTypography.body(
                    size: AppTypography.textLg, weight: FontWeight.w700,),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Upgrade on the web to set spending limits and get 85%/100% alerts.',
                style: AppTypography.body(
                    size: AppTypography.textSm, color: AppColors.textMuted,),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RetryMessage extends StatelessWidget {
  const _RetryMessage({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Couldn’t load your budgets',
              style: AppTypography.body(size: AppTypography.textMd),),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}

String _periodLabel(String period) => switch (period) {
      'DAY' => 'Daily',
      'WEEK' => 'Weekly',
      'MONTH' => 'Monthly',
      _ => period,
    };

Future<void> _openCreateDialog(BuildContext context) async {
  final bloc = context.read<BudgetBloc>();
  final categoryNames = bloc.state.categoryNames;
  final result = await showDialog<_BudgetFormResult>(
    context: context,
    builder: (_) => _BudgetDialog(categoryNames: categoryNames),
  );
  if (result == null) return;
  bloc.add(
    BudgetCreateRequested(
      scope: result.scope,
      categoryId: result.categoryId,
      amount: result.amount,
      period: result.period,
    ),
  );
}

Future<void> _openEditDialog(BuildContext context, BudgetRowView row,
    Map<String, String> categoryNames,) async {
  final bloc = context.read<BudgetBloc>();
  final result = await showDialog<_BudgetFormResult>(
    context: context,
    builder: (_) =>
        _BudgetDialog(existing: row.budget, categoryNames: categoryNames),
  );
  if (result == null) return;
  bloc.add(BudgetUpdateRequested(row.id,
      amount: result.amount, period: result.period,),);
}

Future<void> _confirmDelete(BuildContext context, String id) async {
  final bloc = context.read<BudgetBloc>();
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('Delete this budget?'),
      content: const Text('This can’t be undone.'),
      actions: [
        TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),),
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child:
              const Text('Delete', style: TextStyle(color: AppColors.danger)),
        ),
      ],
    ),
  );
  if (confirmed == true) bloc.add(BudgetDeleteRequested(id));
}

/// The create/edit dialog's submitted values. Kept file-private — nothing
/// outside this screen needs the shape.
class _BudgetFormResult {
  const _BudgetFormResult(
      {required this.scope,
      this.categoryId,
      required this.amount,
      required this.period,});

  final String scope;
  final String? categoryId;
  final double amount;
  final String period;
}

/// Create/edit dialog. Scope is only choosable for a new budget (`TOTAL`/
/// `CATEGORY` — `MEMBER`/`HOUSEHOLD` never reach this dialog, they have no
/// edit affordance on their row). Editing an existing budget keeps its scope
/// and category fixed, only amount/period are mutable (mirrors the backend's
/// `BudgetPatch`, which has no `scope`/`categoryId`).
class _BudgetDialog extends StatefulWidget {
  const _BudgetDialog({this.existing, required this.categoryNames});

  final Budget? existing;
  final Map<String, String> categoryNames;

  @override
  State<_BudgetDialog> createState() => _BudgetDialogState();
}

class _BudgetDialogState extends State<_BudgetDialog> {
  late String _scope;
  String? _categoryId;
  late String _period;
  late final TextEditingController _amountController;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _scope = existing?.scope ?? 'TOTAL';
    _categoryId = existing?.categoryId ??
        (widget.categoryNames.isEmpty ? null : widget.categoryNames.keys.first);
    _period = existing?.period ?? 'MONTH';
    _amountController = TextEditingController(
        text: existing == null ? '' : existing.amount.toStringAsFixed(2),);
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(_isEdit ? 'Edit budget' : 'New budget'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!_isEdit) ...[
              _fieldLabel('Scope'),
              const SizedBox(height: 6),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'TOTAL', label: Text('Total')),
                  ButtonSegment(value: 'CATEGORY', label: Text('Category')),
                ],
                selected: {_scope},
                onSelectionChanged: (selection) =>
                    setState(() => _scope = selection.first),
              ),
              const SizedBox(height: 12),
            ],
            if (_scope == 'CATEGORY') ...[
              _fieldLabel('Category'),
              const SizedBox(height: 6),
              _categoryPicker(),
              const SizedBox(height: 12),
            ],
            WobblioInput(
              key: const Key('budget-amount-input'),
              label: 'Amount',
              controller: _amountController,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 12),
            _fieldLabel('Period'),
            const SizedBox(height: 6),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'DAY', label: Text('Day')),
                ButtonSegment(value: 'WEEK', label: Text('Week')),
                ButtonSegment(value: 'MONTH', label: Text('Month')),
              ],
              selected: {_period},
              onSelectionChanged: (selection) =>
                  setState(() => _period = selection.first),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),),
        TextButton(
          key: const Key('budget-dialog-submit'),
          onPressed: _submit,
          child: Text(_isEdit ? 'Save' : 'Create'),
        ),
      ],
    );
  }

  Widget _fieldLabel(String label) => Text(label.toUpperCase(),
      style: AppTypography.overline(color: AppColors.textMuted),);

  Widget _categoryPicker() {
    if (widget.categoryNames.isEmpty) {
      return Text('No categories available',
          style: AppTypography.body(
              size: AppTypography.textSm, color: AppColors.textMuted,),);
    }
    return DropdownButton<String>(
      key: const Key('budget-category-picker'),
      isExpanded: true,
      value: _categoryId,
      items: [
        for (final entry in widget.categoryNames.entries)
          DropdownMenuItem(value: entry.key, child: Text(entry.value)),
      ],
      onChanged: (value) => setState(() => _categoryId = value),
    );
  }

  void _submit() {
    final amount = double.tryParse(_amountController.text.trim());
    if (amount == null || amount <= 0) return;
    if (_scope == 'CATEGORY' && _categoryId == null) return;
    Navigator.of(context).pop(
      _BudgetFormResult(
        scope: _scope,
        categoryId: _scope == 'CATEGORY' ? _categoryId : null,
        amount: amount,
        period: _period,
      ),
    );
  }
}
