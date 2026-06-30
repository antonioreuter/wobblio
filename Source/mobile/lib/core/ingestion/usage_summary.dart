import 'package:equatable/equatable.dart';

/// Weekly upload-credit usage (`GET /me/usage`). TESTER/ADMIN and unlimited
/// household pools report [unlimited] with null numerics (Infinity isn't JSON).
class UsageSummary extends Equatable {
  const UsageSummary({
    required this.used,
    required this.cap,
    required this.remaining,
    required this.unlimited,
  });

  final int used;
  final int? cap;
  final int? remaining;
  final bool unlimited;

  @override
  List<Object?> get props => [used, cap, remaining, unlimited];
}
