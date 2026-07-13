import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/review/review_bloc.dart';
import 'package:wobblio/core/ingestion/invoice_detail.dart';
import 'package:wobblio/core/ingestion/product_match.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/design_system/wobblio_header.dart';
import 'package:wobblio/ui/format.dart';
import 'package:wobblio/ui/theme/app_theme.dart';

/// Review & correction screen (16e): pinch-zoom photo on top, editable parsed
/// fields below, single Confirm (→ PARSED) plus Discard for a suspected duplicate.
/// Pops `true` when the invoice changed so the dashboard refreshes.
class ReviewScreen extends StatelessWidget {
  const ReviewScreen({super.key, required this.invoiceId});

  final String invoiceId;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<ReviewBloc>(
      create: (_) => locator<ReviewBloc>()..add(ReviewStarted(invoiceId)),
      child: const _ReviewView(),
    );
  }
}

const double _lowConfidence = 0.7;

class _ReviewView extends StatelessWidget {
  const _ReviewView();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ReviewBloc, ReviewState>(
      listenWhen: (prev, curr) =>
          prev.status != curr.status ||
          (curr.notice != null && prev.notice != curr.notice),
      listener: (context, state) {
        if (state.status == ReviewStatus.success ||
            state.status == ReviewStatus.discarded) {
          Navigator.of(context).pop(true);
          return;
        }
        if (state.notice != null) {
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(SnackBar(content: Text(state.notice!)));
        }
      },
      builder: (context, state) {
        return Scaffold(
          key: const Key('review-screen'),
          backgroundColor: Colors.transparent,
          appBar: WobblioHeaderBar(
            title: 'Review receipt',
            onBack: () => Navigator.of(context).maybePop(),
          ),
          body: switch (state.status) {
            ReviewStatus.loading =>
              const Center(child: CircularProgressIndicator()),
            ReviewStatus.failure =>
              const Center(child: Text('Couldn’t load this receipt')),
            _ => _ReviewBody(state: state),
          },
        );
      },
    );
  }
}

class _ReviewBody extends StatelessWidget {
  const _ReviewBody({required this.state});

  final ReviewState state;

  @override
  Widget build(BuildContext context) {
    final busy = state.status == ReviewStatus.submitting;
    return Column(
      children: [
        // Top: pinch-to-zoom receipt photo.
        Expanded(
          flex: 2,
          child: ColoredBox(
            color: AppColors.surface,
            child: state.imageUrl == null
                ? const Center(child: Icon(Icons.image_not_supported_outlined))
                : InteractiveViewer(
                    key: const Key('review-photo'),
                    minScale: 1,
                    maxScale: 5,
                    child: Center(
                      child: Image.network(
                        state.imageUrl!,
                        // A failed/expired presigned URL shows a fallback, not a crash.
                        errorBuilder: (_, __, ___) => const Icon(
                          Icons.broken_image_outlined,
                          color: AppColors.textMuted,
                        ),
                        loadingBuilder: (context, child, progress) =>
                            progress == null
                                ? child
                                : const CircularProgressIndicator(),
                      ),
                    ),
                  ),
          ),
        ),
        // Bottom: scrollable editable fields.
        Expanded(
          flex: 3,
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              _FieldTile(
                key: const Key('review-date'),
                label: 'Date',
                value: state.transactionDate ?? 'Add date',
                onTap: busy ? null : () => _pickDate(context, state),
              ),
              _FieldTile(
                key: const Key('review-total'),
                label: 'Total',
                value: state.total == null
                    ? 'Add total'
                    : formatMoney(state.currency, state.total!),
                onTap: busy ? null : () => _editTotal(context, state),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(4, 16, 4, 8),
                child: Text('Items'),
              ),
              for (final line in state.lines)
                _LineTile(
                  line: line,
                  currency: state.currency,
                  onTap: busy ? null : () => _editLine(context, line),
                ),
              const SizedBox(height: 16),
              if (state.isSuspectedDuplicate)
                OutlinedButton.icon(
                  key: const Key('review-discard'),
                  onPressed: busy
                      ? null
                      : () => context
                          .read<ReviewBloc>()
                          .add(const ReviewDiscarded()),
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Discard duplicate'),
                ),
              const SizedBox(height: 8),
              FilledButton(
                key: const Key('review-confirm'),
                onPressed: busy
                    ? null
                    : () =>
                        context.read<ReviewBloc>().add(const ReviewConfirmed()),
                child: busy
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),)
                    : const Text('Confirm'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _pickDate(BuildContext context, ReviewState state) async {
    final bloc = context.read<ReviewBloc>();
    final initial =
        DateTime.tryParse(state.transactionDate ?? '') ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2015),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    final iso = picked.toIso8601String().substring(0, 10);
    bloc.add(ReviewDateEdited(iso));
  }

  Future<void> _editTotal(BuildContext context, ReviewState state) async {
    final bloc = context.read<ReviewBloc>();
    final value = await _numberDialog(context, 'Total', state.total);
    if (value == null) return;
    bloc.add(ReviewTotalEdited(value));
  }

  Future<void> _editLine(BuildContext context, InvoiceLineDetail line) async {
    final bloc = context.read<ReviewBloc>();
    final edited = await showModalBottomSheet<InvoiceLineDetail>(
      context: context,
      isScrollControlled: true,
      builder: (_) => BlocProvider<ReviewBloc>.value(
        value: bloc,
        child: _LineEditorSheet(line: line),
      ),
    );
    if (edited != null) bloc.add(ReviewLineEdited(edited));
  }
}

class _FieldTile extends StatelessWidget {
  const _FieldTile(
      {super.key,
      required this.label,
      required this.value,
      required this.onTap,});

  final String label;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(label, style: Theme.of(context).textTheme.labelSmall),
        subtitle: Text(value, style: AppTheme.money),
        trailing: const Icon(Icons.edit_outlined, size: 18),
        onTap: onTap,
      ),
    );
  }
}

class _LineTile extends StatelessWidget {
  const _LineTile(
      {required this.line, required this.currency, required this.onTap,});

  final InvoiceLineDetail line;
  final String currency;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final low = line.confidence < _lowConfidence;
    return Card(
      key: Key('review-line-${line.id}'),
      color: low ? AppColors.warning.withValues(alpha: 0.12) : null,
      child: ListTile(
        leading: line.productId == null
            ? const Icon(Icons.help_outline, color: AppColors.warning)
            : const Icon(Icons.check_circle_outline, color: AppColors.success),
        title: Text(line.rawText, maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: low ? const Text('Low confidence — please check') : null,
        trailing:
            Text(formatMoney(currency, line.lineTotal), style: AppTheme.money),
        onTap: onTap,
      ),
    );
  }
}

/// Bottom sheet to fix a single line: product search-as-you-type, quantity,
/// unit price, and line total.
class _LineEditorSheet extends StatefulWidget {
  const _LineEditorSheet({required this.line});

  final InvoiceLineDetail line;

  @override
  State<_LineEditorSheet> createState() => _LineEditorSheetState();
}

class _LineEditorSheetState extends State<_LineEditorSheet> {
  late final TextEditingController _quantity;
  late final TextEditingController _unitPrice;
  late final TextEditingController _lineTotal;
  late final TextEditingController _sizeAmount;
  late String? _productId;
  // "Set size" (09/05): a user-annotated pack size in base units + its unit. Stamped USER on save.
  String? _sizeUnit;

  @override
  void initState() {
    super.initState();
    _quantity = TextEditingController(text: _fmt(widget.line.quantity));
    _unitPrice = TextEditingController(
        text:
            widget.line.unitPrice == null ? '' : _fmt(widget.line.unitPrice!),);
    _lineTotal = TextEditingController(text: _fmt(widget.line.lineTotal));
    _sizeAmount = TextEditingController(
        text: widget.line.packQuantity == null
            ? ''
            : _fmt(widget.line.packQuantity!),);
    _sizeUnit = widget.line.baseUnit;
    _productId = widget.line.productId;
  }

  @override
  void dispose() {
    _quantity.dispose();
    _unitPrice.dispose();
    _lineTotal.dispose();
    _sizeAmount.dispose();
    super.dispose();
  }

  void _save() {
    var edited = widget.line.copyWith(
      productId: _productId,
      quantity: double.tryParse(_quantity.text) ?? widget.line.quantity,
      unitPrice:
          _unitPrice.text.isEmpty ? null : double.tryParse(_unitPrice.text),
      lineTotal: double.tryParse(_lineTotal.text) ?? widget.line.lineTotal,
    );
    // Only stamp the size when the user provided both amount and unit; size is identity
    // metadata (feeds comparability), never a price.
    final sizeAmount = double.tryParse(_sizeAmount.text);
    if (sizeAmount != null && sizeAmount > 0 && _sizeUnit != null) {
      edited = edited.copyWith(
        packQuantity: sizeAmount,
        baseUnit: _sizeUnit,
        sizeSource: 'USER',
      );
    }
    Navigator.of(context).pop(edited);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.line.rawText,
                style: Theme.of(context).textTheme.bodyLarge,),
            const SizedBox(height: 12),
            TextField(
              key: const Key('line-product-search'),
              decoration: const InputDecoration(
                  labelText: 'Match a product', prefixIcon: Icon(Icons.search),),
              onChanged: (q) =>
                  context.read<ReviewBloc>().add(ReviewProductSearched(q)),
            ),
            _ProductResults(
                onPick: (m) => setState(() => _productId = m.productId),
                selectedId: _productId,),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _num(_quantity, 'Qty')),
                const SizedBox(width: 8),
                Expanded(child: _num(_unitPrice, 'Unit price')),
                const SizedBox(width: 8),
                Expanded(child: _num(_lineTotal, 'Line total')),
              ],
            ),
            const SizedBox(height: 8),
            // "Set size" (09/05): descriptive pack size for cross-store comparison — never a price.
            Row(
              children: [
                Expanded(
                  child: _num(_sizeAmount, 'Pack size (e.g. 2 for 2L)'),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    key: const Key('line-size-unit'),
                    initialValue: _sizeUnit,
                    decoration: const InputDecoration(labelText: 'Unit'),
                    items: const [
                      DropdownMenuItem(value: 'L', child: Text('L')),
                      DropdownMenuItem(value: 'KG', child: Text('kg')),
                      DropdownMenuItem(value: 'PIECE', child: Text('pcs')),
                    ],
                    onChanged: (v) => setState(() => _sizeUnit = v),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            FilledButton(
              key: const Key('line-save'),
              onPressed: _save,
              child: const Text('Save item'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _num(TextEditingController c, String label) => TextField(
        controller: c,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(labelText: label),
      );

  static String _fmt(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();
}

class _ProductResults extends StatelessWidget {
  const _ProductResults({required this.onPick, required this.selectedId});

  final ValueChanged<ProductMatch> onPick;
  final String? selectedId;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ReviewBloc, ReviewState>(
      buildWhen: (p, c) =>
          p.searchResults != c.searchResults || p.searching != c.searching,
      builder: (context, state) {
        if (state.searching) {
          return const Padding(
              padding: EdgeInsets.all(12), child: LinearProgressIndicator(),);
        }
        if (state.searchResults.isEmpty) return const SizedBox(height: 8);
        return ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 180),
          child: ListView(
            shrinkWrap: true,
            children: [
              for (final m in state.searchResults)
                ListTile(
                  dense: true,
                  title: Text(m.label),
                  trailing: m.productId == selectedId
                      ? const Icon(Icons.check, color: AppColors.success)
                      : null,
                  onTap: () => onPick(m),
                ),
            ],
          ),
        );
      },
    );
  }
}

Future<double?> _numberDialog(
    BuildContext context, String label, double? initial,) {
  final controller = TextEditingController(text: initial?.toString() ?? '');
  return showDialog<double>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(label),
      content: TextField(
        controller: controller,
        autofocus: true,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),),
        FilledButton(
          onPressed: () =>
              Navigator.of(ctx).pop(double.tryParse(controller.text)),
          child: const Text('Save'),
        ),
      ],
    ),
  );
}
