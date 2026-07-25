part of 'capture_bloc.dart';

sealed class CaptureEvent extends Equatable {
  const CaptureEvent();

  @override
  List<Object?> get props => [];
}

/// Photograph a receipt with the camera (single-page image).
class CaptureFromCameraRequested extends CaptureEvent {
  const CaptureFromCameraRequested();
}

/// Pick an existing receipt image from the gallery (single-page image).
class CaptureFromGalleryRequested extends CaptureEvent {
  const CaptureFromGalleryRequested();
}

/// Pick a PDF document — the multipage path (one file, pages parsed server-side).
class CaptureDocumentRequested extends CaptureEvent {
  const CaptureDocumentRequested();
}

/// The user chose "upload anyway" after the capture-quality gate flagged the photo
/// (fix 11 · sub-spec 05). Re-runs the pipeline on the same bytes with the gate forced off,
/// so no re-capture is needed. Carries the already-picked bytes the gate held back.
class CaptureUploadAnyway extends CaptureEvent {
  const CaptureUploadAnyway(this.raw);

  final Uint8List raw;

  @override
  List<Object?> get props => [raw];
}

/// Return to idle (e.g. after a failure was shown, before retrying).
class CaptureReset extends CaptureEvent {
  const CaptureReset();
}
