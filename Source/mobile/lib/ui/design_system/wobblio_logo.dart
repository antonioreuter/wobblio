import 'package:flutter/material.dart';

import 'package:wobblio/ui/design_system/tokens.dart';

/// Ports `WobblioLogo.tsx`'s mark: two overlapping cubic-bezier strokes on an
/// indigo→teal gradient, viewBox `0 0 48 32`. [withWordmark] appends
/// "wobbl"+"io" (io in brand color) in Outfit bold.
class WobblioLogo extends StatelessWidget {
  const WobblioLogo({super.key, this.size = 32, this.withWordmark = false});

  final double size;
  final bool withWordmark;

  @override
  Widget build(BuildContext context) {
    final mark = SizedBox(
      width: size,
      height: size * 32 / 48,
      child: CustomPaint(painter: _LogoPainter()),
    );
    if (!withWordmark) return mark;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        const SizedBox(width: 10),
        Text.rich(
          TextSpan(
            style: AppTypography.display(
                size: size * 0.62, weight: FontWeight.w800,),
            children: [
              const TextSpan(text: 'wobbl'),
              TextSpan(
                  text: 'io',
                  style: AppTypography.display(
                      size: size * 0.62,
                      weight: FontWeight.w800,
                      color: AppColors.brand,),),
            ],
          ),
        ),
      ],
    );
  }
}

class _LogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 48;
    final sy = size.height / 32;

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5 * ((sx + sy) / 2)
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..shader =
          const LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF0D9488)])
              .createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    // M 6 22 C 10 22, 14 6, 20 6 C 24 6, 26 18, 32 14 L 42 14
    final path1 = Path()
      ..moveTo(6 * sx, 22 * sy)
      ..cubicTo(10 * sx, 22 * sy, 14 * sx, 6 * sy, 20 * sx, 6 * sy)
      ..cubicTo(24 * sx, 6 * sy, 26 * sx, 18 * sy, 32 * sx, 14 * sy)
      ..lineTo(42 * sx, 14 * sy);

    // M 6 22 C 10 22, 15 26, 20 20 C 23 16, 26 12, 30 16 C 33 19, 36 24, 42 24
    final path2 = Path()
      ..moveTo(6 * sx, 22 * sy)
      ..cubicTo(10 * sx, 22 * sy, 15 * sx, 26 * sy, 20 * sx, 20 * sy)
      ..cubicTo(23 * sx, 16 * sy, 26 * sx, 12 * sy, 30 * sx, 16 * sy)
      ..cubicTo(33 * sx, 19 * sy, 36 * sx, 24 * sy, 42 * sx, 24 * sy);

    canvas.drawPath(path1, paint);
    canvas.drawPath(path2, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
