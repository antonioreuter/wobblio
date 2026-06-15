import type {
  IAppUserRepository,
  OnboardingInput,
  OnboardingProfile,
} from '../ports/IAppUserRepository';
import { InvalidProfileError, UserNotFoundError } from '../domain/errors';

export class ProfileService {
  constructor(private readonly userRepo: IAppUserRepository) {}

  async getProfile(cognitoSub: string): Promise<OnboardingProfile> {
    const profile = await this.userRepo.getProfile(cognitoSub);
    if (!profile) throw new UserNotFoundError(cognitoSub);
    return profile;
  }

  async completeOnboarding(cognitoSub: string, input: OnboardingInput): Promise<void> {
    validate(input);
    // The database is the single store for profile/identity data — no Cognito
    // attributes are written. The session reads name/role/status/onboarded from
    // the DB via GET /me/profile at sign-in.
    await this.userRepo.completeOnboarding(cognitoSub, input);
  }
}

function validate(input: OnboardingInput): void {
  if (!input.fullName?.trim()) throw new InvalidProfileError('full name is required');
  if (input.country?.length !== 2) throw new InvalidProfileError('country must be a 2-letter code');
  if (!input.language?.trim()) throw new InvalidProfileError('language is required');
  if (input.currency?.length !== 3) throw new InvalidProfileError('currency must be a 3-letter code');
  if (!input.consent) throw new InvalidProfileError('consent is required');
  if (!isPastDate(input.birthdate)) throw new InvalidProfileError('birthdate must be a valid past date');
}

function isPastDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}
