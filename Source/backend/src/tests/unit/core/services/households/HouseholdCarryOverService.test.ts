import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { HouseholdCarryOverService } from '@core/services/households/HouseholdCarryOverService';
import type { IHouseholdRepository } from '@core/ports/households/IHouseholdRepository';
import { weekStart } from '@core/domain/week';

// A Wednesday — its Monday-UTC week start is 2026-06-22.
const FIXED_NOW = new Date('2026-06-24T12:00:00Z');
const WEEK_START = '2026-06-22';

describe('HouseholdCarryOverService', () => {
  let households: MockedObject<IHouseholdRepository>;
  let sut: HouseholdCarryOverService;

  beforeEach(() => {
    households = {
      countOwnedByUser: vi.fn(),
      create: vi.fn(),
      findMembershipForUser: vi.fn(),
      getOwnerRole: vi.fn(),
      memberCountForUser: vi.fn(),
      findForMember: vi.fn(),
      listMembers: vi.fn(),
      removeMember: vi.fn(),
      disband: vi.fn(),
      leave: vi.fn(),
      carryOverPoolOnActivate: vi.fn(),
      settlePoolToOwner: vi.fn(),
    };
    sut = new HouseholdCarryOverService(households, () => FIXED_NOW);
  });

  describe('onMemberJoined', () => {
    it('seeds the pool from the owner when the 2nd member joins', async () => {
      await sut.onMemberJoined('hh-1', 2);
      expect(households.carryOverPoolOnActivate).toHaveBeenCalledWith('hh-1', WEEK_START);
    });

    it('does nothing for a 3rd member joining an already-pooled household', async () => {
      await sut.onMemberJoined('hh-1', 3);
      expect(households.carryOverPoolOnActivate).not.toHaveBeenCalled();
    });

    it('does nothing while still solo', async () => {
      await sut.onMemberJoined('hh-1', 1);
      expect(households.carryOverPoolOnActivate).not.toHaveBeenCalled();
    });
  });

  describe('onMemberRemoved', () => {
    it('settles to the owner when the drop crosses below the threshold (2→1)', async () => {
      await sut.onMemberRemoved('hh-1', 2);
      expect(households.settlePoolToOwner).toHaveBeenCalledWith('hh-1', WEEK_START);
    });

    it('does nothing when the pool stays active (3→2)', async () => {
      await sut.onMemberRemoved('hh-1', 3);
      expect(households.settlePoolToOwner).not.toHaveBeenCalled();
    });

    it('does nothing when no pool was active (1→0)', async () => {
      await sut.onMemberRemoved('hh-1', 1);
      expect(households.settlePoolToOwner).not.toHaveBeenCalled();
    });
  });

  describe('onDisband', () => {
    it('settles to the owner when a pool was active (count ≥ 2)', async () => {
      await sut.onDisband('hh-1', 2);
      expect(households.settlePoolToOwner).toHaveBeenCalledWith('hh-1', WEEK_START);
    });

    it('settles for a full 3-member household too', async () => {
      await sut.onDisband('hh-1', 3);
      expect(households.settlePoolToOwner).toHaveBeenCalledWith('hh-1', WEEK_START);
    });

    it('does nothing when disbanding a solo household', async () => {
      await sut.onDisband('hh-1', 1);
      expect(households.settlePoolToOwner).not.toHaveBeenCalled();
    });
  });

  it('defaults to the real clock, settling on the current ISO week', async () => {
    const realClock = new HouseholdCarryOverService(households);
    await realClock.onMemberRemoved('hh-1', 2);
    const today = new Date().toISOString().slice(0, 10);
    expect(households.settlePoolToOwner).toHaveBeenCalledWith('hh-1', weekStart(today));
  });
});
