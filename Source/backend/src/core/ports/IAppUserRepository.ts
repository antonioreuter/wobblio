export type UserRole   = 'STANDARD' | 'PREMIUM' | 'TESTER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'WAITLIST' | 'DELETED';

export interface AppUser {
  id: string;
  cognitoSub: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

export interface UserProfile {
  fullName: string;
  country: string;
  language: string;
  currency: string;
}

// Profile captured during post-sign-in onboarding (superset of UserProfile).
export interface OnboardingInput extends UserProfile {
  birthdate: string;  // ISO yyyy-mm-dd
  consent: boolean;
}

export interface OnboardingProfile extends UserProfile {
  birthdate: string | null;
  onboarded: boolean;
  role: UserRole;
  status: UserStatus;
}

export interface IAppUserRepository {
  findByCognitoSub(cognitoSub: string): Promise<AppUser | null>;
  insertUser(cognitoSub: string, email: string, status: UserStatus, profile?: UserProfile): Promise<string>;
  promoteToPremium(userId: string, stripeCustomerId: string): Promise<void>;
  getProfile(cognitoSub: string): Promise<OnboardingProfile | null>;
  completeOnboarding(cognitoSub: string, input: OnboardingInput): Promise<void>;
}
