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

/// Return to idle (e.g. after a failure was shown, before retrying).
class CaptureReset extends CaptureEvent {
  const CaptureReset();
}
