part of 'split_bill_bloc.dart';

sealed class SplitBillEvent extends Equatable {
  const SplitBillEvent();

  @override
  List<Object?> get props => [];
}

/// First load: check premium, resolve the split id (cache-validate, or
/// create a fresh one), then load the invoice's assignable lines and the
/// split's assignments/summary.
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

/// A people chip's remove (×) button tapped — unassigns every line they held.
class SplitBillParticipantRemoved extends SplitBillEvent {
  const SplitBillParticipantRemoved(this.name);

  final String name;

  @override
  List<Object?> get props => [name];
}

/// A line row tapped — drives the assign / fraction-cycle / unassign state
/// machine (see `SplitBillBloc._onLineTapped`).
class SplitBillLineTapped extends SplitBillEvent {
  const SplitBillLineTapped(this.lineId);

  final String lineId;

  @override
  List<Object?> get props => [lineId];
}

/// "Share via WhatsApp" tapped.
class SplitBillWhatsAppRequested extends SplitBillEvent {
  const SplitBillWhatsAppRequested();
}

/// "Copy summary" tapped.
class SplitBillCopyRequested extends SplitBillEvent {
  const SplitBillCopyRequested();
}
