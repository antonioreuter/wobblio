import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

class _MerchantConfig {
  const _MerchantConfig(this.color, this.icon, {this.fg = Colors.white});

  final Color color;
  final IconData icon;
  final Color fg;
}

/// Merchant → (brand color, glyph, glyph color) map, ported verbatim from
/// `MerchantIcon.tsx`'s `MERCHANTS` table (including its prefix-match
/// semantics — `startsWith`, not exact match, and Jumbo's dark-ink glyph on
/// its amber badge). Unknown merchants fall back to a muted `receipt` badge.
const _inkText = Color(0xFF0F172A);
const Map<String, _MerchantConfig> _merchants = {
  'albert heijn':
      _MerchantConfig(AppColors.merchantAh, LucideIcons.shopping_bag),
  'ah to go': _MerchantConfig(AppColors.merchantAh, LucideIcons.coffee),
  'jumbo': _MerchantConfig(AppColors.merchantJumbo, LucideIcons.shopping_cart,
      fg: _inkText,),
  'dirk': _MerchantConfig(AppColors.merchantDirk, LucideIcons.tag),
  'lidl': _MerchantConfig(AppColors.merchantLidl, LucideIcons.coins),
  'tokomania': _MerchantConfig(AppColors.merchantTokomania, LucideIcons.flame),
  'restaurante cantinho':
      _MerchantConfig(AppColors.merchantCantinho, LucideIcons.utensils_crossed),
};

const _fallback = _MerchantConfig(AppColors.textMuted, LucideIcons.receipt);

/// The same brand-color lookup [MerchantIcon] uses, exposed standalone for
/// callers that just need a color swatch (e.g. History's ledger-row status
/// dot) rather than the full icon badge.
Color merchantColor(String merchant) {
  final norm = merchant.toLowerCase().trim();
  return _merchants.entries
      .firstWhere((e) => norm.startsWith(e.key),
          orElse: () => const MapEntry('', _fallback),)
      .value
      .color;
}

/// Ports `MerchantIcon.tsx`: a rounded-square badge in the merchant's brand
/// color holding a representative Lucide glyph.
class MerchantIcon extends StatelessWidget {
  const MerchantIcon({super.key, required this.merchant, this.size = 28});

  final String merchant;
  final double size;

  @override
  Widget build(BuildContext context) {
    final norm = merchant.toLowerCase().trim();
    final cfg = _merchants.entries
        .firstWhere(
          (e) => norm.startsWith(e.key),
          orElse: () => const MapEntry('', _fallback),
        )
        .value;

    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
          color: cfg.color,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),),
      child: Icon(cfg.icon, size: size * 0.55, color: cfg.fg),
    );
  }
}
