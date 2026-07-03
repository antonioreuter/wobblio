import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { AdminCurationService } from '@core/services/admin/AdminCurationService';
import type { ICatalogCurationRepository } from '@core/ports/data-intelligence/ICatalogCurationRepository';
import type { IAdminAuditLog } from '@core/ports/admin/IAdminAuditLog';
import { InvalidAdminInputError, UnknownAdminTargetError, MergeNotAllowedError } from '@core/domain/errors';

const ACTOR = { id: 'admin-1', email: 'admin@wobblio.nl' };

const entity = (id: string, observationCount: number) => ({
  id,
  name: `Merchant ${id}`,
  subtitle: 'NL',
  category: null,
  aliases: ['raw'],
  tenantCount: 5,
  observationCount,
  lastSeenOn: null,
});

const COMPATIBLE = { categoryMatch: true, unitMatch: true, similarity: 0.95 };
const PROVENANCE = { movedAliasIds: ['al-1'], movedObservationCount: 4 };

const NL = { country: 'NL' };
const NL_CAT = { country: 'NL', category: 'cat-dairy' };

describe('AdminCurationService', () => {
  let repo: MockedObject<ICatalogCurationRepository>;
  let audit: MockedObject<IAdminAuditLog>;
  let sut: AdminCurationService;

  beforeEach(() => {
    repo = {
      listProvisionalMerchants: vi.fn(),
      listProvisionalProducts: vi.fn(),
      merchantCountries: vi.fn(),
      productCountries: vi.fn(),
      merchantCategories: vi.fn(),
      productCategories: vi.fn(),
      merchantRegions: vi.fn(),
      productRegions: vi.fn(),
      setMerchantStatus: vi.fn(),
      setProductStatus: vi.fn(),
      releaseProductObservations: vi.fn(),
      releaseMerchantObservations: vi.fn(),
      quarantineProductObservations: vi.fn(),
      quarantineMerchantObservations: vi.fn(),
      mergeMerchant: vi.fn(),
      mergeProduct: vi.fn(),
      getMergeCompatibility: vi.fn(),
      listProductAliases: vi.fn(),
      deactivateAlias: vi.fn(),
    };
    audit = { record: vi.fn(), list: vi.fn() };
    sut = new AdminCurationService(repo, audit);
  });

  it('annotates corroboration against the k=3 quorum', async () => {
    repo.listProvisionalMerchants.mockResolvedValue([entity('a', 2), entity('b', 3)]);
    const items = await sut.list('merchant', NL);
    expect(items[0]).toMatchObject({ corroborationMet: false, quorum: 3 });
    expect(items[1]).toMatchObject({ corroborationMet: true });
  });

  it('requires a country; category is optional (all categories) for both kinds', async () => {
    await expect(sut.list('merchant', {})).rejects.toBeInstanceOf(InvalidAdminInputError);
    await expect(sut.list('product', {})).rejects.toBeInstanceOf(InvalidAdminInputError);
    repo.listProvisionalProducts.mockResolvedValue([]);
    await expect(sut.list('product', NL)).resolves.toEqual([]); // no category → all
  });

  it('defaults and clamps the page window (default 25, max 50, sort whitelist)', async () => {
    repo.listProvisionalProducts.mockResolvedValue([]);
    await sut.list('product', { country: 'NL', category: 'cat-dairy', sort: 'bogus', limit: 999, offset: -5 });
    expect(repo.listProvisionalProducts).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'NL', category: 'cat-dairy', sort: 'waiting', limit: 50, offset: 0 }),
    );
  });

  it('routes facet reads by kind and requires a country', async () => {
    repo.productCategories.mockResolvedValue([{ categoryId: 'cat-dairy', categoryName: 'Dairy', count: 4 }]);
    await sut.categories('product', 'NL', null);
    expect(repo.productCategories).toHaveBeenCalledWith('NL', null);
    repo.merchantCategories.mockResolvedValue([]);
    await sut.categories('merchant', 'NL', null);
    expect(repo.merchantCategories).toHaveBeenCalledWith('NL', null);

    await sut.countries('merchant');
    expect(repo.merchantCountries).toHaveBeenCalled();
    repo.productCountries.mockResolvedValue([]);
    await sut.countries('product');
    expect(repo.productCountries).toHaveBeenCalled();

    await expect(sut.regions('product', '')).rejects.toBeInstanceOf(InvalidAdminInputError);
    repo.merchantRegions.mockResolvedValue([]);
    await sut.regions('merchant', 'NL');
    expect(repo.merchantRegions).toHaveBeenCalledWith('NL');
    repo.productRegions.mockResolvedValue([]);
    await sut.regions('product', 'NL');
    expect(repo.productRegions).toHaveBeenCalledWith('NL');
  });

  it('passes through an explicit region filter and a whitelisted sort', async () => {
    repo.listProvisionalProducts.mockResolvedValue([]);
    await sut.list('product', { country: 'NL', region: 'NL-NB', sort: 'name' });
    expect(repo.listProvisionalProducts).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'NL-NB', sort: 'name' }),
    );
  });

  it('clamps a non-finite limit down to the minimum', async () => {
    repo.listProvisionalProducts.mockResolvedValue([]);
    await sut.list('product', { country: 'NL', limit: NaN });
    expect(repo.listProvisionalProducts).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
  });

  it('approve sets ACTIVE, releases observations, and audits curation.approve', async () => {
    repo.setMerchantStatus.mockResolvedValue(true);
    await sut.approve(ACTOR, 'merchant', 'm-1');
    expect(repo.setMerchantStatus).toHaveBeenCalledWith('m-1', 'ACTIVE');
    expect(repo.releaseMerchantObservations).toHaveBeenCalledWith('m-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'curation.approve', target: 'merchant:m-1' }),
    );
  });

  it('reject maps to INACTIVE, quarantines observations, and audits curation.reject', async () => {
    repo.setProductStatus.mockResolvedValue(true);
    await sut.reject(ACTOR, 'product', 'p-1');
    expect(repo.setProductStatus).toHaveBeenCalledWith('p-1', 'INACTIVE');
    expect(repo.quarantineProductObservations).toHaveBeenCalledWith('p-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'curation.reject', target: 'product:p-1' }),
    );
  });

  it('404s (UnknownAdminTargetError) when the entity is missing, no audit or side effect', async () => {
    repo.setMerchantStatus.mockResolvedValue(false);
    await expect(sut.approve(ACTOR, 'merchant', 'gone')).rejects.toBeInstanceOf(UnknownAdminTargetError);
    expect(audit.record).not.toHaveBeenCalled();
    expect(repo.releaseMerchantObservations).not.toHaveBeenCalled();
  });

  it('merchant merge requires a targetId and audits curation.merge', async () => {
    await expect(sut.merge(ACTOR, 'merchant', 'm-1', '')).rejects.toBeInstanceOf(InvalidAdminInputError);
    repo.mergeMerchant.mockResolvedValue(true);
    await sut.merge(ACTOR, 'merchant', 'm-1', 'm-2');
    expect(repo.mergeMerchant).toHaveBeenCalledWith('m-1', 'm-2');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'curation.merge', after: { targetId: 'm-2' } }),
    );
  });

  it('merchant merge throws when the target/source is missing', async () => {
    repo.mergeMerchant.mockResolvedValue(false);
    await expect(sut.merge(ACTOR, 'merchant', 'm-1', 'gone')).rejects.toBeInstanceOf(UnknownAdminTargetError);
  });

  it('guarded product merge: applies and audits moved-id provenance when compatible', async () => {
    repo.getMergeCompatibility.mockResolvedValue(COMPATIBLE);
    repo.mergeProduct.mockResolvedValue(PROVENANCE);
    await sut.merge(ACTOR, 'product', 'p-1', 'p-2');
    expect(repo.mergeProduct).toHaveBeenCalledWith('p-1', 'p-2');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'curation.merge',
        after: { targetId: 'p-2', movedAliasIds: ['al-1'], movedObservationCount: 4, similarity: 0.95 },
      }),
    );
  });

  it('product merge is refused on category/unit/similarity mismatch (no move, no audit)', async () => {
    repo.getMergeCompatibility.mockResolvedValue({ categoryMatch: false, unitMatch: true, similarity: 0.99 });
    await expect(sut.merge(ACTOR, 'product', 'p-1', 'p-2')).rejects.toBeInstanceOf(MergeNotAllowedError);
    expect(repo.mergeProduct).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('product merge 404s when the compatibility lookup finds no pair', async () => {
    repo.getMergeCompatibility.mockResolvedValue(null);
    await expect(sut.merge(ACTOR, 'product', 'p-1', 'gone')).rejects.toBeInstanceOf(UnknownAdminTargetError);
  });

  it('product merge 404s when mergeProduct itself finds nothing to move', async () => {
    repo.getMergeCompatibility.mockResolvedValue(COMPATIBLE);
    repo.mergeProduct.mockResolvedValue(null);
    await expect(sut.merge(ACTOR, 'product', 'p-1', 'p-2')).rejects.toBeInstanceOf(UnknownAdminTargetError);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('mergeBatch merges compatible sources and skips the rest with a reason', async () => {
    repo.getMergeCompatibility
      .mockResolvedValueOnce(COMPATIBLE) // s1 ok
      .mockResolvedValueOnce({ categoryMatch: true, unitMatch: false, similarity: 0.9 }) // s2 unit mismatch
      .mockResolvedValueOnce(null); // s3 missing
    repo.mergeProduct.mockResolvedValue(PROVENANCE);
    const result = await sut.mergeBatch(ACTOR, 'target', ['s1', 's2', 's3']);
    expect(result.applied).toEqual(['s1']);
    expect(result.skipped).toEqual([
      { id: 's2', reason: 'unit_mismatch' },
      { id: 's3', reason: 'not_found' },
    ]);
    expect(repo.mergeProduct).toHaveBeenCalledTimes(1);
  });

  it('mergeBatch skips a source equal to the target', async () => {
    const result = await sut.mergeBatch(ACTOR, 'target', ['target']);
    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual([{ id: 'target', reason: 'same_as_target' }]);
    expect(repo.getMergeCompatibility).not.toHaveBeenCalled();
  });

  it('mergeBatch rejects empty input', async () => {
    await expect(sut.mergeBatch(ACTOR, 'target', [])).rejects.toBeInstanceOf(InvalidAdminInputError);
    await expect(sut.mergeBatch(ACTOR, '', ['s1'])).rejects.toBeInstanceOf(InvalidAdminInputError);
  });

  it('product approve releases the product observations', async () => {
    repo.setProductStatus.mockResolvedValue(true);
    await sut.approve(ACTOR, 'product', 'p-1');
    expect(repo.releaseProductObservations).toHaveBeenCalledWith('p-1');
  });

  it('merchant reject quarantines the merchant observations', async () => {
    repo.setMerchantStatus.mockResolvedValue(true);
    await sut.reject(ACTOR, 'merchant', 'm-1');
    expect(repo.quarantineMerchantObservations).toHaveBeenCalledWith('m-1');
  });

  it('mergeBatch rethrows an unexpected (non-guard) error', async () => {
    repo.getMergeCompatibility.mockResolvedValue(COMPATIBLE);
    repo.mergeProduct.mockRejectedValue(new Error('db down'));
    await expect(sut.mergeBatch(ACTOR, 'target', ['s1'])).rejects.toThrow('db down');
  });

  it('exposes read pass-throughs for preview, aliases, and merge history', async () => {
    repo.getMergeCompatibility.mockResolvedValue(COMPATIBLE);
    expect(await sut.mergeCompatibility('s', 't')).toBe(COMPATIBLE);
    repo.listProductAliases.mockResolvedValue([]);
    expect(await sut.listProductAliases('p-1')).toEqual([]);
    audit.list.mockResolvedValue([]);
    expect(await sut.listMerges(50)).toEqual([]);
    expect(audit.list).toHaveBeenCalledWith('curation.merge', 50);
  });

  it('deactivateAlias removes a poisoned alias and audits it', async () => {
    repo.deactivateAlias.mockResolvedValue(true);
    await sut.deactivateAlias(ACTOR, 'p-1', 'al-9');
    expect(repo.deactivateAlias).toHaveBeenCalledWith('al-9');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'curation.alias_deactivate', after: { deactivatedAlias: 'al-9' } }),
    );
  });

  it('deactivateAlias 404s when the alias is missing', async () => {
    repo.deactivateAlias.mockResolvedValue(false);
    await expect(sut.deactivateAlias(ACTOR, 'p-1', 'gone')).rejects.toBeInstanceOf(UnknownAdminTargetError);
  });

  it('batch applies to each id and counts successes', async () => {
    repo.setMerchantStatus.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const applied = await sut.batch(ACTOR, 'merchant', 'approve', ['a', 'b', 'c']);
    expect(applied).toBe(2);
  });

  it('batch reject routes through the reject path', async () => {
    repo.setMerchantStatus.mockResolvedValue(true);
    const applied = await sut.batch(ACTOR, 'merchant', 'reject', ['a', 'b']);
    expect(applied).toBe(2);
    expect(repo.setMerchantStatus).toHaveBeenCalledWith('a', 'INACTIVE');
  });

  it('batch rejects an empty id list', async () => {
    await expect(sut.batch(ACTOR, 'merchant', 'approve', [])).rejects.toBeInstanceOf(InvalidAdminInputError);
  });

  it('routes the product kind to the product repository methods', async () => {
    repo.listProvisionalProducts.mockResolvedValue([entity('p', 5)]);
    expect(await sut.list('product', NL_CAT)).toHaveLength(1);
    expect(repo.listProvisionalProducts).toHaveBeenCalled();

    repo.getMergeCompatibility.mockResolvedValue(COMPATIBLE);
    repo.mergeProduct.mockResolvedValue(PROVENANCE);
    await sut.merge(ACTOR, 'product', 'p-1', 'p-2');
    expect(repo.mergeProduct).toHaveBeenCalledWith('p-1', 'p-2');
  });
});
