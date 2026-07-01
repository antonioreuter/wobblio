import 'package:flutter/material.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

/// Ports `Avatar.tsx`: a circle with initials, brand gradient by default or a
/// flat [background] override.
class Avatar extends StatelessWidget {
  const Avatar({super.key, required this.initials, this.size = 36, this.background});

  final String initials;
  final double size;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: background,
        gradient: background == null ? AppColors.gradientAvatar : null,
      ),
      child: Text(
        initials,
        style: AppTypography.display(size: size * 0.36, weight: FontWeight.w700, color: Colors.white),
      ),
    );
  }
}
