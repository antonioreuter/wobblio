part of 'capture_bloc.dart';

/// Where the capture pipeline currently is, surfaced as progress copy.
enum CapturePhase { preparing, presigning, uploading, confirming }

sealed class CaptureState extends Equatable {
  const CaptureState();

  @override
  List<Object?> get props => [];
}

/// Nothing in flight — the action sheet is the entry point.
class CaptureIdle extends CaptureState {
  const CaptureIdle();
}

/// A capture is running; [phase] drives the progress label.
class CaptureInProgress extends CaptureState {
  const CaptureInProgress(this.phase);

  final CapturePhase phase;

  @override
  List<Object?> get props => [phase];
}

/// The receipt was accepted and is now processing; the UI pops to the shell.
class CaptureSuccess extends CaptureState {
  const CaptureSuccess(this.invoiceId);

  final String invoiceId;

  @override
  List<Object?> get props => [invoiceId];
}

/// The capture failed; [code] selects the UX, [message] is the user-facing copy.
class CaptureFailure extends CaptureState {
  const CaptureFailure(this.code, this.message);

  final UploadErrorCode code;
  final String message;

  @override
  List<Object?> get props => [code, message];
}
