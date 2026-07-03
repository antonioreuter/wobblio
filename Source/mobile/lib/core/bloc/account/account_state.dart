part of 'account_bloc.dart';

enum AccountStatus { loading, ready, failure }

/// Single immutable Account state. [email] is nullable independent of
/// [status] — a session with no recoverable `email` claim still reaches
/// `ready`, it just renders without an email line.
class AccountState extends Equatable {
  const AccountState({
    this.status = AccountStatus.loading,
    this.profile,
    this.email,
  });

  final AccountStatus status;
  final UserProfile? profile;
  final String? email;

  AccountState copyWith({
    AccountStatus? status,
    // profile/email are nullable-with-clear, so use explicit sentinels.
    Object? profile = _unset,
    Object? email = _unset,
  }) {
    return AccountState(
      status: status ?? this.status,
      profile: profile == _unset ? this.profile : profile as UserProfile?,
      email: email == _unset ? this.email : email as String?,
    );
  }

  @override
  List<Object?> get props => [status, profile, email];
}

const Object _unset = Object();
