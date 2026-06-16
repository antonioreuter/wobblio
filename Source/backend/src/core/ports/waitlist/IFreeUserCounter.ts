export interface IFreeUserCounter {
  tryClaimSlot(cap: number): Promise<boolean>;
  getCurrentCount(): Promise<number>;
}
