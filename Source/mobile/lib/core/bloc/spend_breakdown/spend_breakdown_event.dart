part of 'spend_breakdown_bloc.dart';

sealed class SpendBreakdownEvent extends Equatable {
  const SpendBreakdownEvent();

  @override
  List<Object?> get props => [];
}

/// Screen mounted — resolve premium + home region, then load the top level.
class SpendBreakdownStarted extends SpendBreakdownEvent {
  const SpendBreakdownStarted();
}

/// Re-fetch the current drill level with the current filters (e.g. Retry after a
/// transient failure) without resetting the drill path, period, or region scope.
class SpendBreakdownReloaded extends SpendBreakdownEvent {
  const SpendBreakdownReloaded();
}

/// Descend into a node (category → merchant → item-category). At the merchant
/// level for a non-premium caller this surfaces the upsell instead.
class SpendBreakdownDrilledInto extends SpendBreakdownEvent {
  const SpendBreakdownDrilledInto(this.node);
  final SpendNode node;

  @override
  List<Object?> get props => [node];
}

/// Jump back up the drill path via a breadcrumb (0 = All spend, 1 = category, 2 = merchant).
class SpendBreakdownCrumbTapped extends SpendBreakdownEvent {
  const SpendBreakdownCrumbTapped(this.depth);
  final int depth;

  @override
  List<Object?> get props => [depth];
}

class SpendBreakdownPeriodChanged extends SpendBreakdownEvent {
  const SpendBreakdownPeriodChanged(this.period);
  final SpendPeriod period;

  @override
  List<Object?> get props => [period];
}

class SpendBreakdownRegionScopeChanged extends SpendBreakdownEvent {
  const SpendBreakdownRegionScopeChanged(this.allRegions);
  final bool allRegions;

  @override
  List<Object?> get props => [allRegions];
}

class SpendBreakdownUpsellDismissed extends SpendBreakdownEvent {
  const SpendBreakdownUpsellDismissed();
}
