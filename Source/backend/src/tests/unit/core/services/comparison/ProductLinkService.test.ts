import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ProductLinkService } from '@core/services/comparison/ProductLinkService';
import type { IProductLinkRepository } from '@core/ports/comparison/IProductLinkRepository';
import { InvalidProductLinkError } from '@core/domain/errors';

// Two valid UUIDs where the first sorts AFTER the second, so canonicalization must reorder them.
const HIGH = 'ffffffff-0000-4000-8000-000000000001';
const LOW = '00000000-0000-4000-8000-000000000002';

describe('ProductLinkService', () => {
  let repo: MockedObject<IProductLinkRepository>;
  let sut: ProductLinkService;

  beforeEach(() => {
    repo = {
      acceptedLinksAmong: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
      setSizeEquivalent: vi.fn().mockResolvedValue(true),
    };
    sut = new ProductLinkService(repo);
  });

  it('linksAmong dedupes valid ids and skips the repo when fewer than two remain', async () => {
    await sut.linksAmong([LOW, LOW, 'not-a-uuid']); // one distinct valid id
    expect(repo.acceptedLinksAmong).not.toHaveBeenCalled();

    await sut.linksAmong([LOW, HIGH, HIGH, 'bad']); // two distinct valid ids
    expect(repo.acceptedLinksAmong).toHaveBeenCalledWith([LOW, HIGH]);
  });

  it('canonicalizes the pair (a < b) before upserting, regardless of argument order', async () => {
    await sut.setStatus(HIGH, LOW, 'ACCEPTED');
    expect(repo.upsert).toHaveBeenCalledWith(LOW, HIGH, 'ACCEPTED');

    await sut.setStatus(LOW, HIGH, 'ACCEPTED');
    expect(repo.upsert).toHaveBeenLastCalledWith(LOW, HIGH, 'ACCEPTED');
  });

  it('dismisses a pair in canonical order', async () => {
    await sut.setStatus(HIGH, LOW, 'DISMISSED');
    expect(repo.upsert).toHaveBeenCalledWith(LOW, HIGH, 'DISMISSED');
  });

  it('canonicalizes before a size-equivalent toggle', async () => {
    await sut.setSizeEquivalent(HIGH, LOW, true);
    expect(repo.setSizeEquivalent).toHaveBeenCalledWith(LOW, HIGH, true);
  });

  it('rejects a size-equivalent toggle on a pair that was never linked', async () => {
    repo.setSizeEquivalent.mockResolvedValue(false);
    await expect(sut.setSizeEquivalent(LOW, HIGH, true)).rejects.toBeInstanceOf(InvalidProductLinkError);
  });

  it('rejects linking a product to itself', async () => {
    await expect(sut.setStatus(LOW, LOW, 'ACCEPTED')).rejects.toBeInstanceOf(InvalidProductLinkError);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('rejects a malformed or missing product id', async () => {
    await expect(sut.setStatus('', LOW, 'ACCEPTED')).rejects.toBeInstanceOf(InvalidProductLinkError);
    await expect(sut.setStatus(LOW, 'not-a-uuid', 'ACCEPTED')).rejects.toBeInstanceOf(InvalidProductLinkError);
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
