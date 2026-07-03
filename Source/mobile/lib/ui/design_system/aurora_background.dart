import 'dart:ui';

import 'package:flutter/material.dart';

/// Ports `AuroraBackground.tsx`: three blurred radial-gradient blobs drifting
/// slowly behind the content. Mounted once in `app.dart` behind `AuthGate`,
/// not per-screen. Skips the drift animation under `MediaQuery.disableAnimations`
/// (this app's equivalent of the web's `prefers-reduced-motion`), matching
/// static blobs instead.
class AuroraBackground extends StatefulWidget {
  const AuroraBackground({super.key});

  @override
  State<AuroraBackground> createState() => _AuroraBackgroundState();
}

class _AuroraBackgroundState extends State<AuroraBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller =
        AnimationController(vsync: this, duration: const Duration(seconds: 16));
    final reduceMotion = WidgetsBinding
        .instance.platformDispatcher.accessibilityFeatures.disableAnimations;
    if (!reduceMotion) _controller.repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: ClipRect(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final t = _controller.value;
            return Stack(
              children: [
                _blob(
                  top: -200,
                  right: -100,
                  width: 650,
                  height: 650,
                  driftY: t * 30,
                  scale: 1 + t * 0.1,
                  gradient: const RadialGradient(
                      colors: [Color(0x266366F1), Colors.transparent],
                      radius: 0.65,),
                ),
                _blob(
                  bottom: -50 + t * -30,
                  left: -150,
                  width: 500,
                  height: 500,
                  driftY: 0,
                  scale: 1,
                  gradient: const RadialGradient(
                      colors: [Color(0x1F0D9488), Colors.transparent],
                      radius: 0.65,),
                ),
                _blob(
                  width: 700,
                  height: 400,
                  driftY: 0,
                  scale: 1,
                  centered: true,
                  gradient: const RadialGradient(
                      colors: [Color(0x14F43F5E), Colors.transparent],
                      radius: 0.65,),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _blob({
    double? top,
    double? bottom,
    double? left,
    double? right,
    required double width,
    required double height,
    required double driftY,
    required double scale,
    required RadialGradient gradient,
    bool centered = false,
  }) {
    final blob = ImageFiltered(
      imageFilter: ImageFilter.blur(sigmaX: 60, sigmaY: 60),
      child: Transform.scale(
        scale: scale,
        child: Container(
          width: width,
          height: height,
          decoration: BoxDecoration(shape: BoxShape.circle, gradient: gradient),
        ),
      ),
    );
    if (centered) {
      return Positioned.fill(
        child: Align(
            alignment: Alignment.center,
            child: Transform.translate(offset: Offset(0, driftY), child: blob),),
      );
    }
    return Positioned(
      top: top == null ? null : top + driftY,
      bottom: bottom,
      left: left,
      right: right,
      child: blob,
    );
  }
}
