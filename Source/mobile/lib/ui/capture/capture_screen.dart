import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/capture/capture_bloc.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/design_system/tokens.dart';

/// Capture entry point (spec 16c / 19d). Presents the prototype-2a "Scan receipt"
/// viewfinder — a dark full-bleed scene with corner brackets, a sweeping laser
/// line and a receipt-preview card — with the big shutter driving the OS camera
/// and Gallery / PDF as secondary sources. Everything runs through [CaptureBloc]
/// (screen-scoped `get_it` factory); on success it pops back to the shell with
/// the new invoice id so the shell can confirm "processing".
class CaptureScreen extends StatelessWidget {
  const CaptureScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<CaptureBloc>(
      create: (_) => locator<CaptureBloc>(),
      child: const _CaptureView(),
    );
  }
}

class _CaptureView extends StatelessWidget {
  const _CaptureView();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<CaptureBloc, CaptureState>(
      listenWhen: (_, current) =>
          current is CaptureSuccess ||
          current is CaptureFailure ||
          current is CaptureLowQuality,
      listener: (context, state) {
        if (state is CaptureSuccess) {
          Navigator.of(context).pop(state.invoiceId);
          return;
        }
        if (state is CaptureLowQuality) {
          _showLowQualitySheet(context, state);
          return;
        }
        if (state is CaptureFailure) {
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(
              SnackBar(
                key: const Key('capture-error-snackbar'),
                content: Text(state.message),
              ),
            );
        }
      },
      builder: (context, state) {
        final busy = state is CaptureInProgress;
        return Scaffold(
          key: const Key('capture-screen'),
          backgroundColor: const Color(0xFF06070C),
          body: Stack(
            fit: StackFit.expand,
            children: [
              const Positioned.fill(child: _SceneGradient()),
              const Positioned.fill(child: Center(child: _Viewfinder())),
              _TopBar(onBack: () => Navigator.of(context).maybePop()),
              _BottomControls(enabled: !busy),
              if (busy) _ProgressOverlay(phase: state.phase),
            ],
          ),
        );
      },
    );
  }
}

/// Soft stop for the capture-quality gate (fix 11 · sub-spec 05): explain the issue and let the
/// user retake or upload the held bytes anyway. Never a hard block — a false positive can't stop
/// a real receipt. Retake returns to idle; "upload anyway" re-runs the pipeline with force.
Future<void> _showLowQualitySheet(BuildContext context, CaptureLowQuality state) async {
  final bloc = context.read<CaptureBloc>();
  await showModalBottomSheet<void>(
    context: context,
    backgroundColor: const Color(0xFF11131C),
    showDragHandle: true,
    builder: (sheetContext) {
      return SafeArea(
        child: Padding(
          key: const Key('capture-low-quality-sheet'),
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'This photo may be hard to read',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 10),
              Text(
                state.message,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 14, height: 1.4),
              ),
              const SizedBox(height: 20),
              FilledButton(
                key: const Key('capture-retake-button'),
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  bloc.add(const CaptureReset());
                },
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.brand,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Retake photo'),
              ),
              const SizedBox(height: 10),
              TextButton(
                key: const Key('capture-upload-anyway-button'),
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  bloc.add(CaptureUploadAnyway(state.raw));
                },
                child: Text(
                  'Upload anyway',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.75)),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

/// The `radial-gradient(120% 60% at 50% 40%, #11131c, #04050a)` scene wash.
class _SceneGradient extends StatelessWidget {
  const _SceneGradient();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: RadialGradient(
          center: Alignment(0, -0.2),
          radius: 1.1,
          colors: [Color(0xFF11131C), Color(0xFF04050A)],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(
            children: [
              _CircleButton(
                key: const Key('capture-back-button'),
                icon: Icons.chevron_left,
                onPressed: onBack,
              ),
              const Expanded(
                child: Text(
                  'Scan receipt',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 38),
            ],
          ),
        ),
      ),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({
    super.key,
    required this.icon,
    required this.onPressed,
  });

  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.08),
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onPressed,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 38,
          height: 38,
          child: Icon(icon, size: 22, color: Colors.white),
        ),
      ),
    );
  }
}

/// The receipt-preview card framed by brand corner brackets and a sweeping
/// laser line. The preview is a static mock (the OS camera provides the real
/// frame) — its job is to make the viewfinder read as alive.
class _Viewfinder extends StatefulWidget {
  const _Viewfinder();

  @override
  State<_Viewfinder> createState() => _ViewfinderState();
}

class _ViewfinderState extends State<_Viewfinder>
    with SingleTickerProviderStateMixin {
  late final AnimationController _laser = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  )..repeat(reverse: true);

  static const double _w = 230;
  static const double _h = 340;

  @override
  void dispose() {
    _laser.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _w,
      height: _h,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          const Positioned.fill(child: _ReceiptPreview()),
          // Sweeping laser line.
          AnimatedBuilder(
            animation: _laser,
            builder: (context, _) {
              return Positioned(
                left: -6,
                right: -6,
                top: 12 + (_h - 24) * _laser.value,
                child: Container(
                  height: 3,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(3),
                    gradient: const LinearGradient(
                      colors: [
                        Color(0x00000000),
                        AppColors.indigo500,
                        AppColors.teal600,
                        Color(0x00000000),
                      ],
                    ),
                    boxShadow: const [
                      BoxShadow(color: AppColors.brandGlow, blurRadius: 20, spreadRadius: 4),
                    ],
                  ),
                ),
              );
            },
          ),
          // Corner brackets.
          const _Corner(top: -10, left: -10),
          const _Corner(top: -10, right: -10),
          const _Corner(bottom: -10, left: -10),
          const _Corner(bottom: -10, right: -10),
        ],
      ),
    );
  }
}

/// An L-shaped brand corner guide. The two solid edges are chosen by which of
/// [top]/[bottom] and [left]/[right] is supplied.
class _Corner extends StatelessWidget {
  const _Corner({this.top, this.bottom, this.left, this.right});

  final double? top;
  final double? bottom;
  final double? left;
  final double? right;

  @override
  Widget build(BuildContext context) {
    const side = BorderSide(color: AppColors.brand, width: 3);
    return Positioned(
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      child: Container(
        width: 26,
        height: 26,
        decoration: BoxDecoration(
          border: Border(
            top: top != null ? side : BorderSide.none,
            bottom: bottom != null ? side : BorderSide.none,
            left: left != null ? side : BorderSide.none,
            right: right != null ? side : BorderSide.none,
          ),
          borderRadius: BorderRadius.only(
            topLeft: top != null && left != null
                ? const Radius.circular(6)
                : Radius.zero,
            topRight: top != null && right != null
                ? const Radius.circular(6)
                : Radius.zero,
            bottomLeft: bottom != null && left != null
                ? const Radius.circular(6)
                : Radius.zero,
            bottomRight: bottom != null && right != null
                ? const Radius.circular(6)
                : Radius.zero,
          ),
        ),
      ),
    );
  }
}

class _ReceiptPreview extends StatelessWidget {
  const _ReceiptPreview();

  static const _mono = TextStyle(
    fontFamily: 'monospace',
    color: Color(0xFF3A3733),
    fontSize: 8,
    height: 1.7,
    letterSpacing: 0.3,
  );

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF4F1EA), Color(0xFFD9D4C8)],
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0xB3000000),
            blurRadius: 50,
            offset: Offset(0, 30),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'AH TO GO · EINDHOVEN',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'monospace',
                color: Color(0xFF3A3733),
                fontSize: 10,
                height: 1.7,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            _line('Verse jus 1L', '2.49'),
            _line('Croissant', '1.15'),
            _line('Cappuccino', '3.20'),
            _line('Bananen', '1.89'),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  border: Border(
                    top: BorderSide(color: Color(0xFF8A857A), width: 0.6),
                  ),
                ),
                child: SizedBox(height: 1, width: double.infinity),
              ),
            ),
            _line('TOTAAL', '12.15', bold: true),
            const SizedBox(height: 8),
            const Text(
              '||| || |||| | ||',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'monospace',
                color: Color(0xFF3A3733),
                fontSize: 10,
                letterSpacing: 2,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Widget _line(String name, String amount, {bool bold = false}) {
    final style = bold
        ? _mono.copyWith(fontWeight: FontWeight.w700)
        : _mono;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(name, style: style),
        Text(amount, style: style),
      ],
    );
  }
}

class _BottomControls extends StatelessWidget {
  const _BottomControls({required this.enabled});

  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<CaptureBloc>();
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Align the receipt · tap to scan',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.7),
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 18),
              _ShutterButton(
                onPressed: enabled
                    ? () => bloc.add(const CaptureFromCameraRequested())
                    : null,
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  Expanded(
                    child: _SecondarySource(
                      key: const Key('capture-gallery-button'),
                      icon: Icons.photo_library_outlined,
                      label: 'Gallery',
                      onPressed: enabled
                          ? () => bloc
                              .add(const CaptureFromGalleryRequested())
                          : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _SecondarySource(
                      key: const Key('capture-pdf-button'),
                      icon: Icons.picture_as_pdf_outlined,
                      label: 'PDF',
                      onPressed: enabled
                          ? () =>
                              bloc.add(const CaptureDocumentRequested())
                          : null,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The 74×74 shutter: a white ring around a brand-gradient core.
class _ShutterButton extends StatelessWidget {
  const _ShutterButton({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Take a photo',
      child: GestureDetector(
        key: const Key('capture-camera-button'),
        onTap: onPressed,
        child: Container(
          width: 74,
          height: 74,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.25),
              width: 5,
            ),
          ),
          child: Center(
            child: Container(
              width: 54,
              height: 54,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: AppColors.gradientBrand,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SecondarySource extends StatelessWidget {
  const _SecondarySource({
    super.key,
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 18),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: Colors.white,
        side: const BorderSide(color: AppColors.glassBorder),
        backgroundColor: Colors.white.withValues(alpha: 0.04),
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
      ),
    );
  }
}

class _ProgressOverlay extends StatelessWidget {
  const _ProgressOverlay({required this.phase});

  final CapturePhase phase;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xFF06070C).withValues(alpha: 0.9),
      child: Center(
        key: const Key('capture-progress'),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(
              _label(phase),
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
          ],
        ),
      ),
    );
  }

  static String _label(CapturePhase phase) => switch (phase) {
        CapturePhase.preparing => 'Preparing image…',
        CapturePhase.presigning => 'Starting upload…',
        CapturePhase.uploading => 'Uploading…',
        CapturePhase.confirming => 'Finishing up…',
      };
}
