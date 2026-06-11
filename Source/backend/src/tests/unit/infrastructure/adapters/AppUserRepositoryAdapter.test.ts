import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppUserRepositoryAdapter } from '@infrastructure/adapters/AppUserRepositoryAdapter';
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
    it('calls provision_new_user with correct arguments', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ provision_new_user: 'new-uuid' }],
      });

      const id = await adapter.insertUser('sub-456', 'new@test.nl', 'ACTIVE');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT provision_new_user($1, $2, $3)',
        ['sub-456', 'new@test.nl', 'ACTIVE'],
      );
      expect(id).toBe('new-uuid');
    });

    it('calls provision_new_user with WAITLIST status', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ provision_new_user: 'waitlist-uuid' }],
      });

      await adapter.insertUser('sub-789', 'waitlist@test.nl', 'WAITLIST');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['sub-789', 'waitlist@test.nl', 'WAITLIST'],
      );
    });
  });
});
