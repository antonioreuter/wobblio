import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppUserRepositoryAdapter } from '@infrastructure/adapters/identity/AppUserRepositoryAdapter';
import type { Pool } from 'pg';

describe('AppUserRepositoryAdapter', () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let adapter: AppUserRepositoryAdapter;

  beforeEach(() => {
    mockPool = { query: vi.fn() };
    adapter = new AppUserRepositoryAdapter(mockPool as unknown as Pool);
  });

  describe('findByCognitoSub', () => {
    it('calls resolve_app_user_by_cognito_sub with the correct argument', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await adapter.findByCognitoSub('sub-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM resolve_app_user_by_cognito_sub($1)',
        ['sub-123'],
      );
    });

    it('returns null when no row is found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await adapter.findByCognitoSub('unknown-sub');

      expect(result).toBeNull();
    });

    it('maps DB row to AppUser domain object', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'uuid-abc',
          cognito_sub: 'sub-123',
          email: 'user@example.com',
          role: 'STANDARD',
          status: 'ACTIVE',
        }],
      });

      const user = await adapter.findByCognitoSub('sub-123');

      expect(user).toEqual({
        id: 'uuid-abc',
        cognitoSub: 'sub-123',
        email: 'user@example.com',
        role: 'STANDARD',
        status: 'ACTIVE',
      });
    });
  });

  describe('insertUser', () => {
    it('calls provision_new_user with correct arguments including default profile', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ provision_new_user: 'new-uuid' }],
      });

      const id = await adapter.insertUser('sub-456', 'new@test.nl', 'ACTIVE');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT provision_new_user($1, $2, $3, $4, $5, $6, $7)',
        ['sub-456', 'new@test.nl', 'ACTIVE', '', 'NL', 'nl', 'EUR'],
      );
      expect(id).toBe('new-uuid');
    });

    it('calls provision_new_user with provided profile fields', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ provision_new_user: 'profile-uuid' }],
      });

      await adapter.insertUser('sub-456', 'new@test.nl', 'ACTIVE', {
        fullName: 'Jan de Vries',
        country: 'NL',
        language: 'nl',
        currency: 'EUR',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT provision_new_user($1, $2, $3, $4, $5, $6, $7)',
        ['sub-456', 'new@test.nl', 'ACTIVE', 'Jan de Vries', 'NL', 'nl', 'EUR'],
      );
    });

    it('calls provision_new_user with WAITLIST status', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ provision_new_user: 'waitlist-uuid' }],
      });

      await adapter.insertUser('sub-789', 'waitlist@test.nl', 'WAITLIST');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT provision_new_user($1, $2, $3, $4, $5, $6, $7)',
        ['sub-789', 'waitlist@test.nl', 'WAITLIST', '', 'NL', 'nl', 'EUR'],
      );
    });
  });

  describe('promoteToPremium', () => {
    it('updates role to PREMIUM, sets the stripe customer id, and lifts WAITLIST status', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1, rows: [] });

      await adapter.promoteToPremium('uuid-abc', 'cus_mock_x');

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain("role = 'PREMIUM'");
      expect(sql).toContain('stripe_customer_id = $2');
      expect(sql).toContain("status = CASE WHEN status = 'WAITLIST'");
      expect(params).toEqual(['uuid-abc', 'cus_mock_x']);
    });
  });
});
