part of 'account_bloc.dart';

sealed class AccountEvent extends Equatable {
  const AccountEvent();

  @override
  List<Object?> get props => [];
}

/// First (and only) load: fetch the profile and the stored token bundle in
/// parallel, decode `email` out of the latter.
class AccountStarted extends AccountEvent {
  const AccountStarted();
}
