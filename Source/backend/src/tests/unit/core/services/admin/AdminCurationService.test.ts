import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { AdminCurationService } from '@core/services/admin/AdminCurationService';
import type { ICatalogCurationRepository } from '@core/ports/data-intelligence/ICatalogCurationRepository';
import type { IAdminAuditLog } from '@core/ports/admin/IAdminAuditLog';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';

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
      mergeMerchant: vi.fn(),
      mergeProduct: vi.fn(),
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
    await sut.countries('merchant');
    expect(repo.merchantCountries).toHaveBeenCalled();
    await expect(sut.regions('product', '')).rejects.toBeInstanceOf(InvalidAdminInputError);
  });

  it('approve sets ACTIVE and audits curation.approve', async () => {
    repo.setMerchantStatus.mockResolvedValue(true);
    await sut.approve(ACTOR, 'merchant', 'm-1');
    expect(repo.setMerchantStatus).toHaveBeenCalledWith('m-1', 'ACTIVE');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'curation.approve', target: 'merchant:m-1' }),
    );
  });

  it('reject maps to INACTIVE (no REJECTED status)', async () => {
    repo.setProductStatus.mockResolvedValue(true);
    await sut.reject(ACTOR, 'product', 'p-1');
    expect(repo.setProductStatus).toHaveBeenCalledWith('p-1', 'INACTIVE');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'curation.reject', target: 'product:p-1' }),
    );
  });

  it('404s (UnknownAdminTargetError) when the entity is missing, no audit', async () => {
    repo.setMerchantStatus.mockResolvedValue(false);
    await expect(sut.approve(ACTOR, 'merchant', 'gone')).rejects.toBeInstanceOf(UnknownAdminTargetError);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('merge requires a targetId and audits curation.merge', async () => {
    await expect(sut.merge(ACTOR, 'merchant', 'm-1', '')).rejects.toBeInstanceOf(InvalidAdminInputError);
    repo.mergeMerchant.mockResolvedValue(true);
    await sut.merge(ACTOR, 'merchant', 'm-1', 'm-2');
    expect(repo.mergeMerchant).toHaveBeenCalledWith('m-1', 'm-2');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'curation.merge', after: { targetId: 'm-2' } }),
    );
  });

  it('merge throws when the target/source is missing', async () => {
    repo.mergeMerchant.mockResolvedValue(false);
    await expect(sut.merge(ACTOR, 'merchant', 'm-1', 'gone')).rejects.toBeInstanceOf(UnknownAdminTargetError);
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

    repo.mergeProduct.mockResolvedValue(true);
    await sut.merge(ACTOR, 'product', 'p-1', 'p-2');
    expect(repo.mergeProduct).toHaveBeenCalledWith('p-1', 'p-2');
  });
});
