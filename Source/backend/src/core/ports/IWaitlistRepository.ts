export interface WaitlistUser {
  id: string;
  email: string;
}

export interface IWaitlistRepository {
  getWaitlistedBatch(limit: number): Promise<WaitlistUser[]>;
  activateUsers(userIds: string[]): Promise<number>;
  getWaitlistCount(): Promise<number>;
}
