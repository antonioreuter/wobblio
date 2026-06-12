import type { Pool } from 'pg';
import type { IAppUserRepository, AppUser, UserStatus, UserProfile } from '@core/ports/IAppUserRepository';
import { UserNotFoundError } from '@core/domain/errors';

interface DbUserRow {
  id: string;
  cognito_sub: string;
  email: string;
  role: string;
  status: string;
}

export class AppUserRepositoryAdapter implements IAppUserRepository {
  constructor(private readonly pool: Pool) {}

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
