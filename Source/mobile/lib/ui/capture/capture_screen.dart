import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:wobblio/core/bloc/capture/capture_bloc.dart';
import 'package:wobblio/main.dart';
import 'package:wobblio/ui/design_system/wobblio_header.dart';
import 'package:wobblio/ui/theme/app_theme.dart';

/// Capture entry point (spec 16c). Offers the three sources — camera, gallery,
/// PDF — drives them through [CaptureBloc], and pops back to the shell with the
/// new invoice id on success so the shell can confirm "processing". The bloc is
/// screen-scoped (a `get_it` factory), created here and closed on dispose.
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
          current is CaptureSuccess || current is CaptureFailure,
      listener: (context, state) {
        if (state is CaptureSuccess) {
          Navigator.of(context).pop(state.invoiceId);
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
          backgroundColor: Colors.transparent,
          appBar: WobblioHeaderBar(
            title: 'Add receipt',
            onBack: () => Navigator.of(context).maybePop(),
          ),
          body: Stack(
            children: [
              _SourceActions(enabled: !busy),
              if (busy) _ProgressOverlay(phase: state.phase),
            ],
          ),
        );
      },
    );
  }
}

class _SourceActions extends StatelessWidget {
  const _SourceActions({required this.enabled});

  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _SourceButton(
              key: const Key('capture-camera-button'),
              icon: Icons.photo_camera,
              label: 'Take a photo',
              onPressed: enabled
                  ? () => context
                      .read<CaptureBloc>()
                      .add(const CaptureFromCameraRequested())
                  : null,
            ),
            const SizedBox(height: 12),
            _SourceButton(
              key: const Key('capture-gallery-button'),
              icon: Icons.photo_library_outlined,
              label: 'Choose from gallery',
              onPressed: enabled
                  ? () => context
                      .read<CaptureBloc>()
                      .add(const CaptureFromGalleryRequested())
                  : null,
            ),
            const SizedBox(height: 12),
            _SourceButton(
              key: const Key('capture-pdf-button'),
              icon: Icons.picture_as_pdf_outlined,
              label: 'Upload a PDF',
              onPressed: enabled
                  ? () => context
                      .read<CaptureBloc>()
                      .add(const CaptureDocumentRequested())
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _SourceButton extends StatelessWidget {
  const _SourceButton({
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
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: onPressed,
        icon: Icon(icon),
        label: Text(label),
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 16),
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
      color: AppColors.background.withValues(alpha: 0.85),
      child: Center(
        key: const Key('capture-progress'),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(_label(phase), style: Theme.of(context).textTheme.bodyLarge),
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
