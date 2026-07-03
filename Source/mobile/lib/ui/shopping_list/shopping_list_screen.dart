import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/shopping_list/shopping_list_bloc.dart';
import 'package:wobblio/core/domain/shopping_list_categories.dart';
import 'package:wobblio/core/lists/optimization_result.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/design_system/button.dart';
import 'package:wobblio/ui/design_system/checkbox.dart';
import 'package:wobblio/ui/design_system/glass_container.dart';
import 'package:wobblio/ui/design_system/merchant_icon.dart';
import 'package:wobblio/ui/design_system/tokens.dart';
import 'package:wobblio/ui/format.dart';

/// Shopping List screen (18c): "Add item", split-route savings banner
/// (Premium + optimized only), per-store subtotal chips, checkable rows,
/// estimated total. See
/// `specs/mvp/18-mobile-navigation-and-lists/18c-shopping-list.md`.
class ShoppingListScreen extends StatelessWidget {
  const ShoppingListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<ShoppingListBloc>(
      create: (_) =>
          locator<ShoppingListBloc>()..add(const ShoppingListStarted()),
      child: const _ShoppingListView(),
    );
  }
}

class _ShoppingListView extends StatelessWidget {
  const _ShoppingListView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('shopping-list-screen'),
      body: SafeArea(
        child: BlocConsumer<ShoppingListBloc, ShoppingListState>(
          listenWhen: (prev, curr) =>
              curr.notice != null && prev.notice != curr.notice,
          listener: (context, state) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(state.notice!)));
          },
          builder: (context, state) {
            if (state.status == ShoppingListStatus.loading) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state.status == ShoppingListStatus.failure) {
              return _RetryMessage(
                onRetry: () => context
                    .read<ShoppingListBloc>()
                    .add(const ShoppingListStarted()),
              );
            }
            if (state.status == ShoppingListStatus.empty) {
              return const _EmptyState();
            }
            return RefreshIndicator(
              onRefresh: () async => context
                  .read<ShoppingListBloc>()
                  .add(const ShoppingListRefreshed()),
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                    sliver: SliverToBoxAdapter(child: _Header(state: state)),
                  ),
                  if (state.showsSplitRouteBanner)
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      sliver: SliverToBoxAdapter(
                          child: _SavingsBanner(
                              optimization: state.optimization!,),),
                    ),
                  if (state.storeGroups.isNotEmpty)
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      sliver: SliverToBoxAdapter(
                          child: _StoreChipsRow(groups: state.storeGroups),),
                    ),
                  SliverPadding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    sliver: SliverList.list(
                      children: [
                        for (final group in state.storeGroups)
                          for (final row in group.rows) _ItemRow(row: row),
                        for (final row in state.ungroupedRows)
                          _ItemRow(row: row),
                      ],
                    ),
                  ),
                  if (state.estimatedTotal > 0)
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      sliver: SliverToBoxAdapter(
                        child: _TotalFooter(total: state.estimatedTotal),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.state});

  final ShoppingListState state;

  @override
  Widget build(BuildContext context) {
    final itemCount = (state.list?.items.length ?? 0);
    final storeCount = state.storeGroups.length;
    final countLabel = storeCount > 1
        ? '$itemCount items · $storeCount stops'
        : '$itemCount items';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Shopping list',
                  style: AppTypography.display(size: AppTypography.text2xl),),
              const SizedBox(height: 2),
              Text(countLabel,
                  style: AppTypography.body(
                      size: AppTypography.textXs, color: AppColors.textMuted,),),
            ],
          ),
        ),
        WobblioButton(
          key: const Key('shopping-list-add-item'),
          label: 'Add item',
          variant: WobblioButtonVariant.outline,
          iconLeft: Icons.add,
          onPressed: () => _promptAddItem(context),
        ),
      ],
    );
  }

  Future<void> _promptAddItem(BuildContext context) async {
    final bloc = context.read<ShoppingListBloc>();
    final controller = TextEditingController();
    final text = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Add item'),
        content: TextField(
            controller: controller,
            autofocus: true,
            decoration: const InputDecoration(hintText: 'e.g. Bananen'),),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),),
          TextButton(
            onPressed: () =>
                Navigator.of(dialogContext).pop(controller.text.trim()),
            child: const Text('Add'),
          ),
        ],
      ),
    );
    if (text != null && text.isNotEmpty) {
      bloc.add(ShoppingListItemAdded(text));
    }
  }
}

class _SavingsBanner extends StatelessWidget {
  const _SavingsBanner({required this.optimization});

  final OptimizationResult optimization;

  @override
  Widget build(BuildContext context) {
    final saving = formatMoney('EUR', optimization.totalExpectedSaving);
    return GlassContainer(
      padding: const EdgeInsets.all(15),
      borderColor: AppColors.successBorder,
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                color: AppColors.successGlow,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),),
            child:
                const Icon(Icons.alt_route, size: 20, color: AppColors.success),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: AppTypography.body(
                    size: AppTypography.textSm, weight: FontWeight.w700,),
                children: [
                  TextSpan(
                      text: 'Split-route saves $saving',
                      style: const TextStyle(color: AppColors.success),),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StoreChipsRow extends StatelessWidget {
  const _StoreChipsRow({required this.groups});

  final List<ShoppingListStoreGroup> groups;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < groups.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.glassBorder),
                borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
              ),
              child: Row(
                children: [
                  Container(
                    width: 26,
                    height: 26,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                        color: merchantColor(groups[i].name),
                        borderRadius:
                            BorderRadius.circular(AppSpacing.radiusSm),),
                    child: Text('${i + 1}',
                        style: AppTypography.display(
                            size: 12,
                            weight: FontWeight.w800,
                            color: Colors.white,),),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(groups[i].name,
                            style: AppTypography.body(
                                size: AppTypography.textXs,
                                weight: FontWeight.w600,),
                            overflow: TextOverflow.ellipsis,),
                        Text(formatMoney('EUR', groups[i].subtotal),
                            style: AppTypography.body(
                                size: AppTypography.text2xs,
                                color: AppColors.textMuted,),),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({required this.row});

  final ShoppingListRowView row;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: Key('shopping-list-item-${row.itemId}'),
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.glassBorder)),),
      child: Row(
        children: [
          WobblioCheckbox(
            value: row.checked,
            onChanged: (_) => context
                .read<ShoppingListBloc>()
                .add(ShoppingListItemToggled(row.itemId)),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.name,
                  style: AppTypography.body(
                    size: AppTypography.textMd,
                    weight: FontWeight.w600,
                    color: row.checked
                        ? AppColors.textMuted
                        : AppColors.textPrimary,
                  ).copyWith(
                      decoration:
                          row.checked ? TextDecoration.lineThrough : null,),
                ),
                if (row.storeName != null)
                  Row(
                    children: [
                      Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                              color: merchantColor(row.storeName!),
                              shape: BoxShape.circle,),),
                      const SizedBox(width: 6),
                      Text(
                        '${row.quantity == row.quantity.roundToDouble() ? row.quantity.toInt() : row.quantity} · ${row.storeName}',
                        style: AppTypography.body(
                            size: AppTypography.textXs,
                            color: AppColors.textMuted,),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          if (row.price != null)
            Text(formatMoney('EUR', row.price!),
                style: AppTypography.body(
                    size: AppTypography.textSm,
                    weight: FontWeight.w700,
                    color: AppColors.textSecondary,),),
          IconButton(
            key: Key('shopping-list-remove-${row.itemId}'),
            icon: const Icon(Icons.close, size: 16, color: AppColors.textMuted),
            onPressed: () => context
                .read<ShoppingListBloc>()
                .add(ShoppingListItemRemoved(row.itemId)),
          ),
        ],
      ),
    );
  }
}

class _TotalFooter extends StatelessWidget {
  const _TotalFooter({required this.total});

  final double total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(top: 14),
      decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.glassBorder)),),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('Estimated total',
              style: AppTypography.body(
                  size: AppTypography.textSm,
                  weight: FontWeight.w600,
                  color: AppColors.textSecondary,),),
          Text(
            formatMoney('EUR', total),
            style: AppTypography.display(
                size: AppTypography.textXl,
                weight: FontWeight.w800,
                tabularNumbers: true,),
          ),
        ],
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
            const Icon(Icons.checklist, size: 48, color: AppColors.brand),
            const SizedBox(height: 16),
            Text('No shopping list yet',
                style: AppTypography.body(size: AppTypography.textMd),),
            const SizedBox(height: 16),
            WobblioButton(
              key: const Key('shopping-list-create'),
              label: 'Create a list',
              onPressed: () => _createList(context),
            ),
          ],
        ),
      ),
    );
  }

  void _createList(BuildContext context) {
    context.read<ShoppingListBloc>().add(
          const ShoppingListCreateRequested(
              'My list', ShoppingListCategories.groceries,),
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
          Text('Couldn’t load your shopping list',
              style: AppTypography.body(size: AppTypography.textMd),),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
