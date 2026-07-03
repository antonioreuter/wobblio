import 'package:flutter/material.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

/// Ports `Input.tsx`. [flagged] is the low-confidence state used by the
/// review screen's line items: an amber left-inset bar, tinted background,
/// and an amber label — this is the state's only consumer, so get it right.
class WobblioInput extends StatefulWidget {
  const WobblioInput({
    super.key,
    this.controller,
    this.label,
    this.icon,
    this.flagged = false,
    this.readOnly = false,
    this.onTap,
    this.keyboardType,
    this.onChanged,
    this.onSubmitted,
    this.autofocus = false,
  });

  final TextEditingController? controller;
  final String? label;
  final IconData? icon;
  final bool flagged;
  final bool readOnly;
  final VoidCallback? onTap;
  final TextInputType? keyboardType;
  final ValueChanged<String>? onChanged;

  /// Fires on the keyboard's submit action (e.g. Enter) — lets a caller like
  /// Split Bill's "Add a person" field submit without a separate button tap.
  final ValueChanged<String>? onSubmitted;
  final bool autofocus;

  @override
  State<WobblioInput> createState() => _WobblioInputState();
}

class _WobblioInputState extends State<WobblioInput> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final borderColor = widget.flagged
        ? AppColors.warning
        : _focused
            ? AppColors.brand
            : AppColors.glassBorder;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null) ...[
          Text(
            widget.label!.toUpperCase(),
            style: AppTypography.overline(
              color: widget.flagged ? AppColors.warning : AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 6),
        ],
        Container(
          height: AppSpacing.controlHeight,
          decoration: BoxDecoration(
            color: widget.flagged
                ? AppColors.warning.withValues(alpha: 0.04)
                : AppColors.glassHighlight,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: widget.flagged
                ? const Border(
                    top: BorderSide(color: AppColors.warning),
                    right: BorderSide(color: AppColors.warning),
                    bottom: BorderSide(color: AppColors.warning),
                    left: BorderSide(color: AppColors.warning, width: 4),
                  )
                : Border.all(color: borderColor),
            boxShadow: !widget.flagged && _focused
                ? [
                    const BoxShadow(
                        color: AppColors.brandGlow,
                        blurRadius: 0,
                        spreadRadius: 3,),
                  ]
                : null,
          ),
          child: Row(
            children: [
              if (widget.icon != null) ...[
                const SizedBox(width: 14),
                Icon(widget.icon, size: 18, color: AppColors.textMuted),
                const SizedBox(width: 10),
              ] else
                const SizedBox(width: 14),
              Expanded(
                child: Focus(
                  onFocusChange: (f) => setState(() => _focused = f),
                  child: TextField(
                    controller: widget.controller,
                    readOnly: widget.readOnly,
                    onTap: widget.onTap,
                    keyboardType: widget.keyboardType,
                    onChanged: widget.onChanged,
                    onSubmitted: widget.onSubmitted,
                    autofocus: widget.autofocus,
                    style: AppTypography.body(size: AppTypography.textMd),
                    decoration: const InputDecoration(
                        border: InputBorder.none, isDense: true,),
                  ),
                ),
              ),
              const SizedBox(width: 14),
            ],
          ),
        ),
      ],
    );
  }
}
