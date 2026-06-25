import type { PoolClient } from 'pg';
import type {
  IHouseholdRepository,
  HouseholdSummary,
  HouseholdMember,
  HouseholdMembership,
} from '@core/ports/households/IHouseholdRepository';

interface HouseholdRow {
  id: string;
  name: string;
  owner_user_id: string;
}

interface MemberRow {
  user_id: string;
  email: string;
  full_name: string;
  is_owner: boolean;
  uploads_this_week: number;
}

// All methods rely on RLS (app.current_tenant_id) set on this client's transaction.
// Cross-tenant operations (roster, owner-privileged writes) go through SECURITY
// DEFINER functions defined in the households/invites migration.
export class HouseholdRepositoryAdapter implements IHouseholdRepository {
  constructor(private readonly client: PoolClient) {}

  async countOwnedByUser(userId: string): Promise<number> {
    const result = await this.client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM household WHERE owner_user_id = $1`,
      [userId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async create(ownerUserId: string, name: string): Promise<string> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO household (owner_user_id, name) VALUES ($1, $2) RETURNING id`,
      [ownerUserId, name],
    );
    const id = result.rows[0].id;
    await this.client.query(
      `INSERT INTO household_member (household_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [id, ownerUserId],
    );
    return id;
  }

  async findMembershipForUser(userId: string): Promise<HouseholdMembership | null> {
    const result = await this.client.query<{ household_id: string; owner_user_id: string }>(
      `SELECT h.id AS household_id, h.owner_user_id
       FROM household_member m
       JOIN household h ON h.id = m.household_id
       WHERE m.user_id = $1`,
      [userId],
    );
    const row = result.rows[0];
    return row ? { householdId: row.household_id, ownerUserId: row.owner_user_id } : null;
  }

  async memberCountForUser(householdId: string, userId: string): Promise<number> {
    const result = await this.client.query<{ count: number }>(
      `SELECT household_member_count_for($1, $2) AS count`,
      [householdId, userId],
    );
    return result.rows[0].count;
  }

  async findForMember(householdId: string): Promise<HouseholdSummary | null> {
    const result = await this.client.query<HouseholdRow>(
      `SELECT id, name, owner_user_id FROM household WHERE id = $1`,
      [householdId],
    );
    const row = result.rows[0];
    return row ? { id: row.id, name: row.name, ownerUserId: row.owner_user_id } : null;
  }

  async listMembers(householdId: string): Promise<HouseholdMember[]> {
    const result = await this.client.query<MemberRow>(
      `SELECT user_id, email, full_name, is_owner, uploads_this_week
       FROM list_household_members($1)`,
      [householdId],
    );
    return result.rows.map(row => ({
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name,
      isOwner: row.is_owner,
      uploadsThisWeek: row.uploads_this_week,
    }));
  }

  async removeMember(householdId: string, memberId: string, ownerId: string): Promise<boolean> {
    const result = await this.client.query<{ remove_household_member: boolean }>(
      `SELECT remove_household_member($1, $2, $3)`,
      [householdId, memberId, ownerId],
    );
    return result.rows[0].remove_household_member;
  }

  async disband(householdId: string, ownerId: string): Promise<boolean> {
    const result = await this.client.query<{ disband_household: boolean }>(
      `SELECT disband_household($1, $2)`,
      [householdId, ownerId],
    );
    return result.rows[0].disband_household;
  }

  async leave(householdId: string, userId: string): Promise<void> {
    await this.client.query(
      `DELETE FROM household_member WHERE household_id = $1 AND user_id = $2`,
      [householdId, userId],
    );
  }
}
