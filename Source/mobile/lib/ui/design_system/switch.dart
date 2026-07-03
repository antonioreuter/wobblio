import 'package:flutter/material.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

/// Ports `Switch.tsx`: a 46×24 pill, `success` track when on / `textMuted`
/// when off, white thumb. Built as a plain widget rather than themed via
/// `SwitchThemeData` so the on/off colors match the web tokens exactly.
class WobblioSwitch extends StatelessWidget {
  const WobblioSwitch(
      {super.key, required this.value, required this.onChanged,});

  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    final disabled = onChanged == null;
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: GestureDetector(
        onTap: disabled ? null : () => onChanged!(!value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: 46,
          height: 24,
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: value ? AppColors.success : AppColors.textMuted,
            borderRadius: BorderRadius.circular(34),
          ),
          child: AnimatedAlign(
            duration: const Duration(milliseconds: 300),
            alignment: value ? Alignment.centerRight : Alignment.centerLeft,
            child: Container(
              width: 18,
              height: 18,
              decoration: const BoxDecoration(
                  color: Colors.white, shape: BoxShape.circle,),
            ),
          ),
        ),
      ),
    );
  }
}
