// The per-week system-fault alert threshold (§07.4). Alert-only — the delete-lock already
// prevents farming, so there is no hard guard; this just drives the admin ops-view flag.
export interface ISystemFaultLimitsProvider {
  getMaxSystemFaultsPerWeek(): Promise<number>;
}
