export interface IWaitlistCapProvider {
  getMaxFreeUsersCap(): Promise<number>;
}
