export interface IWaitlistStatusPort {
  isWaitlistActive(): Promise<boolean>;
}
