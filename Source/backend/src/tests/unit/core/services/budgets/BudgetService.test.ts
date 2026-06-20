import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { BudgetService } from '@core/services/budgets/BudgetService';
import type { IBudgetRepository, BudgetView } from '@core/ports/budgets/IBudgetRepository';
import type { IHouseholdRepository, HouseholdMember } from '@core/ports/households/IHouseholdRepository';
import {
  PremiumRequiredError,
  InvalidBudgetError,
  BudgetLimitError,
  BudgetNotFoundError,
  NotHouseholdOwnerError,
} from '@core/domain/errors';

const view: BudgetView = {
  id: 'b1', scope: 'TOTAL', categoryId: null, memberUserId: null,
  amount: 200, period: 'MONTH', accumulated: 0,
  alert85Fired: false, alert100Fired: false, alert85At: null, alert100At: null,
  cycleStart: '2026-06-01',
};

const totalBudget = { scope: 'TOTAL' as const, categoryId: null, memberUserId: null, amount: 200, period: 'MONTH' as const };
const memberBudget = { scope: 'MEMBER' as const, categoryId: null, memberUserId: 'm9', amount: 200, period: 'MONTH' as const };
const householdBudget = { scope: 'HOUSEHOLD' as const, categoryId: null, memberUserId: null, amount: 200, period: 'MONTH' as const };

const member = (userId: string): HouseholdMember => ({
  userId, email: `${userId}@x`, fullName: userId, isOwner: false, uploadsThisWeek: 0,
});

describe('BudgetService', () => {
  let repo: MockedObject<IBudgetRepository>;
  let households: MockedObject<IHouseholdRepository>;
  let sut: BudgetService;

  beforeEach(() => {
    repo = {
      create: vi.fn(),
      countForTenant: vi.fn().mockResolvedValue(0),
      listForTenant: vi.fn(),
      computeSpend: vi.fn().mockResolvedValue(0),
      get: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    households = {
      countOwnedByUser: vi.fn(),
      create: vi.fn(),
      findMembershipForUser: vi.fn().mockResolvedValue(null),
      findForMember: vi.fn(),
      listMembers: vi.fn().mockResolvedValue([]),
      removeMember: vi.fn(),
      disband: vi.fn(),
      leave: vi.fn(),
    };
    sut = new BudgetService(repo, households);
  });

  describe('create', () => {
    it('rejects STANDARD users', async () => {
      await expect(sut.create('u1', 'STANDARD', totalBudget)).rejects.toBeInstanceOf(PremiumRequiredError);
    });

    it('allows an ADMIN user (elevated role has premium access)', async () => {
      repo.create.mockResolvedValue('b1');
      repo.get.mockResolvedValue(view);
      await expect(sut.create('u1', 'ADMIN', totalBudget)).resolves.toEqual(view);
    });

    it('rejects a non-positive amount', async () => {
      await expect(sut.create('u1', 'PREMIUM', { ...totalBudget, amount: 0 })).rejects.toBeInstanceOf(InvalidBudgetError);
    });

    it('rejects an unknown scope', async () => {
      await expect(
        sut.create('u1', 'PREMIUM', { ...totalBudget, scope: 'WEEKLY' as never }),
      ).rejects.toBeInstanceOf(InvalidBudgetError);
    });

    it('rejects an unknown period', async () => {
      await expect(
        sut.create('u1', 'PREMIUM', { ...totalBudget, period: 'YEAR' as never }),
      ).rejects.toBeInstanceOf(InvalidBudgetError);
    });

    it('requires a categoryId for CATEGORY scope', async () => {
      await expect(
        sut.create('u1', 'PREMIUM', { ...totalBudget, scope: 'CATEGORY', categoryId: null }),
      ).rejects.toBeInstanceOf(InvalidBudgetError);
    });

    it('requires a memberUserId for MEMBER scope', async () => {
      await expect(
        sut.create('u1', 'PREMIUM', { ...totalBudget, scope: 'MEMBER', memberUserId: null }),
      ).rejects.toBeInstanceOf(InvalidBudgetError);
    });

    it('enforces the 10-budget limit', async () => {
      repo.countForTenant.mockResolvedValue(10);
      await expect(sut.create('u1', 'PREMIUM', totalBudget)).rejects.toBeInstanceOf(BudgetLimitError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates the budget and returns the persisted view', async () => {
      repo.create.mockResolvedValue('b1');
      repo.get.mockResolvedValue(view);

      const result = await sut.create('u1', 'PREMIUM', totalBudget);

      expect(repo.create).toHaveBeenCalledWith({ tenantId: 'u1', ...totalBudget });
      expect(result).toEqual(view);
    });

    it('throws BudgetNotFoundError when the created budget cannot be read back', async () => {
      repo.create.mockResolvedValue('b1');
      repo.get.mockResolvedValue(null);
      await expect(sut.create('u1', 'PREMIUM', totalBudget)).rejects.toBeInstanceOf(BudgetNotFoundError);
    });
  });

  describe('create authorization', () => {
    it('lets a solo user (no household) create a TOTAL budget', async () => {
      repo.create.mockResolvedValue('b1');
      repo.get.mockResolvedValue(view);
      await expect(sut.create('u1', 'PREMIUM', totalBudget)).resolves.toEqual(view);
    });

    it('rejects a solo user creating a MEMBER budget (no household to scope)', async () => {
      await expect(sut.create('u1', 'PREMIUM', memberBudget)).rejects.toBeInstanceOf(NotHouseholdOwnerError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects a non-owner household member for every scope', async () => {
      households.findMembershipForUser.mockResolvedValue({ householdId: 'h1', ownerUserId: 'owner' });
      await expect(sut.create('u1', 'PREMIUM', totalBudget)).rejects.toBeInstanceOf(NotHouseholdOwnerError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('lets the owner create a MEMBER budget for a roster member', async () => {
      households.findMembershipForUser.mockResolvedValue({ householdId: 'h1', ownerUserId: 'u1' });
      households.listMembers.mockResolvedValue([member('m9')]);
      repo.create.mockResolvedValue('b1');
      repo.get.mockResolvedValue(view);
      await expect(sut.create('u1', 'PREMIUM', memberBudget)).resolves.toEqual(view);
    });

    it('rejects an owner MEMBER budget for someone outside the household', async () => {
      households.findMembershipForUser.mockResolvedValue({ householdId: 'h1', ownerUserId: 'u1' });
      households.listMembers.mockResolvedValue([member('someone-else')]);
      await expect(sut.create('u1', 'PREMIUM', memberBudget)).rejects.toBeInstanceOf(InvalidBudgetError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects a solo user creating a HOUSEHOLD budget (no household to scope)', async () => {
      await expect(sut.create('u1', 'PREMIUM', householdBudget)).rejects.toBeInstanceOf(NotHouseholdOwnerError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('lets the owner create a HOUSEHOLD budget with no category', async () => {
      households.findMembershipForUser.mockResolvedValue({ householdId: 'h1', ownerUserId: 'u1' });
      repo.create.mockResolvedValue('b1');
      repo.get.mockResolvedValue(view);
      await expect(sut.create('u1', 'PREMIUM', householdBudget)).resolves.toEqual(view);
      expect(repo.create).toHaveBeenCalledWith({ tenantId: 'u1', ...householdBudget });
    });

    it('lets the owner create a HOUSEHOLD budget scoped to one category', async () => {
      households.findMembershipForUser.mockResolvedValue({ householdId: 'h1', ownerUserId: 'u1' });
      repo.create.mockResolvedValue('b1');
      repo.get.mockResolvedValue(view);
      const scoped = { ...householdBudget, categoryId: 'cat-groceries' };
      await expect(sut.create('u1', 'PREMIUM', scoped)).resolves.toEqual(view);
      expect(repo.create).toHaveBeenCalledWith({ tenantId: 'u1', ...scoped });
    });
  });

  describe('update', () => {
    it('rejects a non-positive amount patch', async () => {
      await expect(sut.update('b1', { amount: -5 })).rejects.toBeInstanceOf(InvalidBudgetError);
    });

    it('rejects an unknown period patch', async () => {
      await expect(sut.update('b1', { period: 'YEAR' as never })).rejects.toBeInstanceOf(InvalidBudgetError);
    });

    it('updates only the period', async () => {
      repo.update.mockResolvedValue(true);
      await sut.update('b1', { period: 'WEEK' });
      expect(repo.update).toHaveBeenCalledWith('b1', { period: 'WEEK' });
    });

    it('throws BudgetNotFoundError when nothing was updated', async () => {
      repo.update.mockResolvedValue(false);
      await expect(sut.update('ghost', { amount: 50 })).rejects.toBeInstanceOf(BudgetNotFoundError);
    });

    it('updates an existing budget', async () => {
      repo.update.mockResolvedValue(true);
      await sut.update('b1', { amount: 300, period: 'WEEK' });
      expect(repo.update).toHaveBeenCalledWith('b1', { amount: 300, period: 'WEEK' });
    });
  });

  describe('remove', () => {
    it('throws BudgetNotFoundError when nothing was removed', async () => {
      repo.remove.mockResolvedValue(false);
      await expect(sut.remove('ghost')).rejects.toBeInstanceOf(BudgetNotFoundError);
    });

    it('removes an existing budget', async () => {
      repo.remove.mockResolvedValue(true);
      await sut.remove('b1');
      expect(repo.remove).toHaveBeenCalledWith('b1');
    });
  });

  describe('list (live spend)', () => {
    it('overrides stored accumulated with live spend over the current window', async () => {
      repo.listForTenant.mockResolvedValue([{ ...view, accumulated: 0 }]);
      repo.computeSpend.mockResolvedValue(137.5);

      const [result] = await sut.list('u1', '2026-06-20');

      expect(result.accumulated).toBe(137.5);
      // MONTH budget cycleStart 2026-06-01 contains 2026-06-20 → window unchanged.
      expect(repo.computeSpend).toHaveBeenCalledWith({
        tenantId: 'u1',
        scope: 'TOTAL',
        categoryId: null,
        memberUserId: null,
        from: '2026-06-01',
        to: '2026-07-01',
      });
    });

    it('rolls the window forward to the period containing today', async () => {
      repo.listForTenant.mockResolvedValue([{ ...view, period: 'WEEK', cycleStart: '2026-06-01' }]);
      repo.computeSpend.mockResolvedValue(10);

      const [result] = await sut.list('u1', '2026-06-20');

      // 2026-06-01 + weeks → the window containing 2026-06-20 starts 2026-06-15.
      expect(result.cycleStart).toBe('2026-06-15');
      expect(repo.computeSpend).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-06-15', to: '2026-06-22' }),
      );
    });
  });
});
