import type { Pool, PoolClient } from 'pg';
import type {
  IAppUserRepository,
  AppUser,
  UserStatus,
  UserProfile,
  OnboardingInput,
  OnboardingProfile,
} from '@core/ports/IAppUserRepository';
import { UserNotFoundError } from '@core/domain/errors';

interface DbUserRow {
  id: string;
  cognito_sub: string;
  email: string;
  role: string;
  status: string;
}

interface DbProfileRow {
  full_name: string;
  country_code: string;
  language: string;
  home_currency: string;
  birthdate: string | null;
  onboarded: boolean;
  role: string;
  status: string;
}

export class AppUserRepositoryAdapter implements IAppUserRepository {
  // Accepts a pooled client so a request can run every query on the single
  // acquired connection (shared RLS tenant context; avoids exhausting max:1).
  constructor(private readonly pool: Pool | PoolClient) {}

  async findByCognitoSub(cognitoSub: string): Promise<AppUser | null> {
    const result = await this.pool.query<DbUserRow>(
      'SELECT * FROM resolve_app_user_by_cognito_sub($1)',
      [cognitoSub],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      cognitoSub: row.cognito_sub,
      email: row.email,
      role: row.role as AppUser['role'],
      status: row.status as AppUser['status'],
    };
  }

  async insertUser(
    cognitoSub: string,
    email: string,
    status: UserStatus,
    profile?: UserProfile,
  ): Promise<string> {
    const result = await this.pool.query<{ provision_new_user: string }>(
      'SELECT provision_new_user($1, $2, $3, $4, $5, $6, $7)',
      [
        cognitoSub,
        email,
        status,
        profile?.fullName ?? '',
        profile?.country ?? 'NL',
        profile?.language ?? 'nl',
        profile?.currency ?? 'EUR',
      ],
    );
    const id = result.rows[0]?.provision_new_user;
    if (!id) throw new UserNotFoundError(cognitoSub);
    return id;
  }

  async getProfile(cognitoSub: string): Promise<OnboardingProfile | null> {
    const result = await this.pool.query<DbProfileRow>(
      'SELECT * FROM get_user_profile($1)',
      [cognitoSub],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      fullName: row.full_name,
      country: row.country_code,
      language: row.language,
      currency: row.home_currency,
      birthdate: row.birthdate,
      onboarded: row.onboarded,
      role: row.role as OnboardingProfile['role'],
      status: row.status as OnboardingProfile['status'],
    };
  }

  async completeOnboarding(cognitoSub: string, input: OnboardingInput): Promise<void> {
    const result = await this.pool.query<{ complete_user_onboarding: string | null }>(
      'SELECT complete_user_onboarding($1, $2, $3, $4, $5, $6, $7)',
      [
        cognitoSub,
        input.fullName,
        input.country,
        input.language,
        input.currency,
        input.birthdate,
        input.consent,
      ],
    );
    if (!result.rows[0]?.complete_user_onboarding) throw new UserNotFoundError(cognitoSub);
  }

  async promoteToPremium(userId: string, stripeCustomerId: string): Promise<void> {
    await this.pool.query(
      `UPDATE app_user
          SET role = 'PREMIUM',
              stripe_customer_id = $2,
              status = CASE WHEN status = 'WAITLIST' THEN 'ACTIVE'::user_status ELSE status END
        WHERE id = $1`,
      [userId, stripeCustomerId],
    );
  }
}
