export type UserRole   = 'STANDARD' | 'PREMIUM' | 'TESTER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'WAITLIST' | 'DELETED';

export interface AppUser {
  id: string;
  cognitoSub: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

export interface IAppUserRepository {
  findByCognitoSub(cognitoSub: string): Promise<AppUser | null>;
  insertUser(cognitoSub: string, email: string, status: UserStatus): Promise<string>;
  promoteToPremium(userId: string, stripeCustomerId: string): Promise<void>;
}
