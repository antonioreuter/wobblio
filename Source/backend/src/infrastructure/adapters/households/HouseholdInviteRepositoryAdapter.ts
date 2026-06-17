import type { PoolClient } from 'pg';
import type {
  IHouseholdInviteRepository,
  CreateInviteInput,
  AcceptInviteResult,
  AcceptInviteCode,
} from '@core/ports/households/IHouseholdInviteRepository';

export class HouseholdInviteRepositoryAdapter implements IHouseholdInviteRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateInviteInput): Promise<string> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO household_invite
         (household_id, created_by_user_id, token_hash, token_enc, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [input.householdId, input.createdByUserId, input.tokenHash, input.tokenEnc, input.expiresAt],
    );
    return result.rows[0].id;
  }

  async revoke(householdId: string, inviteId: string): Promise<boolean> {
    const result = await this.client.query(
      `UPDATE household_invite SET revoked_at = now()
       WHERE id = $1 AND household_id = $2 AND revoked_at IS NULL`,
      [inviteId, householdId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async accept(tokenHash: string, userId: string): Promise<AcceptInviteResult> {
    const result = await this.client.query<{ result_code: AcceptInviteCode; household_id: string | null }>(
      `SELECT result_code, household_id FROM accept_household_invite($1, $2)`,
      [tokenHash, userId],
    );
    const row = result.rows[0];
    return { code: row.result_code, householdId: row.household_id };
  }
}
