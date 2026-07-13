import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ComparisonSetService, COMPARISON_SET_MAX_MEMBERS } from '@core/services/comparison/ComparisonSetService';
import type { IComparisonSetRepository } from '@core/ports/comparison/IComparisonSetRepository';
import {
  ComparisonSetLimitError,
  ComparisonSetNotFoundError,
  InvalidComparisonSetError,
} from '@core/domain/errors';

describe('ComparisonSetService', () => {
  let repo: MockedObject<IComparisonSetRepository>;
  let sut: ComparisonSetService;

  beforeEach(() => {
    repo = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn().mockResolvedValue('set-1'),
      rename: vi.fn().mockResolvedValue(true),
      remove: vi.fn().mockResolvedValue(true),
      memberCount: vi.fn().mockResolvedValue(0),
      exists: vi.fn().mockResolvedValue(true),
      addMember: vi.fn().mockResolvedValue('mem-1'),
      removeMember: vi.fn().mockResolvedValue(true),
      setSizeEquivalent: vi.fn().mockResolvedValue(true),
    };
    sut = new ComparisonSetService(repo);
  });

  it('trims and caps the set name, coercing blank to null', async () => {
    await sut.create('  milk  ');
    expect(repo.create).toHaveBeenCalledWith('milk');
    await sut.create('   ');
    expect(repo.create).toHaveBeenLastCalledWith(null);
  });

  it('adds a member with the size-equivalence answer', async () => {
    const id = await sut.addMember('set-1', 'prod-1', true);
    expect(id).toBe('mem-1');
    expect(repo.addMember).toHaveBeenCalledWith('set-1', 'prod-1', true);
  });

  it('rejects an add when the set is missing', async () => {
    repo.exists.mockResolvedValue(false);
    await expect(sut.addMember('gone', 'prod-1', false)).rejects.toBeInstanceOf(ComparisonSetNotFoundError);
    expect(repo.addMember).not.toHaveBeenCalled();
  });

  it('enforces the 5-member cap', async () => {
    repo.memberCount.mockResolvedValue(COMPARISON_SET_MAX_MEMBERS);
    await expect(sut.addMember('set-1', 'prod-6', false)).rejects.toBeInstanceOf(ComparisonSetLimitError);
    expect(repo.addMember).not.toHaveBeenCalled();
  });

  it('maps a duplicate add (null id) to an invalid-set error', async () => {
    repo.addMember.mockResolvedValue(null);
    await expect(sut.addMember('set-1', 'prod-1', false)).rejects.toBeInstanceOf(InvalidComparisonSetError);
  });

  it('rejects an add with no product', async () => {
    await expect(sut.addMember('set-1', '', false)).rejects.toBeInstanceOf(InvalidComparisonSetError);
  });

  it('round-trips the size_equivalent toggle', async () => {
    await sut.setSizeEquivalent('set-1', 'mem-1', true);
    expect(repo.setSizeEquivalent).toHaveBeenCalledWith('set-1', 'mem-1', true);
  });

  it('404s a toggle on a missing set/member', async () => {
    repo.setSizeEquivalent.mockResolvedValue(false);
    await expect(sut.setSizeEquivalent('set-1', 'gone', true)).rejects.toBeInstanceOf(ComparisonSetNotFoundError);
  });

  it('404s rename/remove/removeMember when nothing was affected', async () => {
    repo.rename.mockResolvedValue(false);
    repo.remove.mockResolvedValue(false);
    repo.removeMember.mockResolvedValue(false);
    await expect(sut.rename('gone', 'x')).rejects.toBeInstanceOf(ComparisonSetNotFoundError);
    await expect(sut.remove('gone')).rejects.toBeInstanceOf(ComparisonSetNotFoundError);
    await expect(sut.removeMember('gone', 'm')).rejects.toBeInstanceOf(ComparisonSetNotFoundError);
  });

  it('404s get when the set does not exist', async () => {
    repo.getById.mockResolvedValue(null);
    await expect(sut.get('gone')).rejects.toBeInstanceOf(ComparisonSetNotFoundError);
  });
});
