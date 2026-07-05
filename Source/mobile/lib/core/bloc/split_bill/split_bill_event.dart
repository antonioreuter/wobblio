part of 'split_bill_bloc.dart';

sealed class SplitBillEvent extends Equatable {
  const SplitBillEvent();

  @override
  List<Object?> get props => [];
}

/// First load: check premium, resolve the split id (cache-validate, or
/// create a fresh one), then load the invoice's assignable lines and the
/// split's allocations/summary.
class SplitBillStarted extends SplitBillEvent {
  const SplitBillStarted();
}

/// "Add" submitted on the participant name field.
class SplitBillParticipantAdded extends SplitBillEvent {
  const SplitBillParticipantAdded(this.name);

  final String name;

  @override
  List<Object?> get props => [name];
}

/// A people chip tapped — sets the active line-assignment target.
class SplitBillParticipantSelected extends SplitBillEvent {
  const SplitBillParticipantSelected(this.name);

  final String name;

  @override
  List<Object?> get props => [name];
}

/// A people chip's remove (×) button tapped — strips them from every line they
/// held (recomputing each line's remaining allocation set).
class SplitBillParticipantRemoved extends SplitBillEvent {
  const SplitBillParticipantRemoved(this.name);

  final String name;

  @override
  List<Object?> get props => [name];
}

/// A single-unit line row tapped — drives the assign / fraction-cycle / clear
/// state machine (see `SplitBillBloc._onLineTapped`).
class SplitBillLineTapped extends SplitBillEvent {
  const SplitBillLineTapped(this.lineId);

  final String lineId;

  @override
  List<Object?> get props => [lineId];
}

/// A multi-unit line's +/− stepper — nudges the active participant's unit
/// count by [delta] (capped by what's unassigned on the line).
class SplitBillLineStepped extends SplitBillEvent {
  const SplitBillLineStepped(this.lineId, this.delta);

  final String lineId;
  final int delta;

  @override
  List<Object?> get props => [lineId, delta];
}

/// A multi-unit line's "Reset" button — clears every allocation on the line
/// (all units fall back to the implicit "You").
class SplitBillLineReset extends SplitBillEvent {
  const SplitBillLineReset(this.lineId);

  final String lineId;

  @override
  List<Object?> get props => [lineId];
}

/// "Create share link" tapped — mints a public `/s/{token}` link and hands it
/// to the native share sheet.
class SplitBillShareLinkRequested extends SplitBillEvent {
  const SplitBillShareLinkRequested();
}

/// "Share via WhatsApp" tapped.
class SplitBillWhatsAppRequested extends SplitBillEvent {
  const SplitBillWhatsAppRequested();
}

/// "Copy summary" tapped.
class SplitBillCopyRequested extends SplitBillEvent {
  const SplitBillCopyRequested();
}
