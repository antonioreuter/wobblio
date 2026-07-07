import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { SpendReportService, type SpendReportParams } from '@core/services/reporting/SpendReportService';
import type { ISpendReportQuery } from '@core/ports/reporting/ISpendReportQuery';
import { UNCATEGORIZED_ID, UNKNOWN_MERCHANT_ID } from '@core/domain/spendReport';
import { PremiumRequiredError, InvalidSpendReportQueryError } from '@core/domain/errors';

// A merchantId is bound to a ::uuid cast in SQL, so the service validates the format — fixtures
// must use a real UUID (not a placeholder like 'm1').
const MID = '11111111-1111-1111-1111-111111111111';

const base: SpendReportParams = {
  preset: 'LAST_90D',
  from: null,
  to: null,
  country: 'NL',
  region: 'NL-NB',
  categoryId: null,
  merchantId: null,
  itemCategoryId: null,
};

describe('SpendReportService', () => {
  let query: MockedObject<ISpendReportQuery>;
  let sut: SpendReportService;

  beforeEach(() => {
    query = {
      categories: vi.fn().mockResolvedValue([]),
      merchants: vi.fn().mockResolvedValue([]),
      itemCategories: vi.fn().mockResolvedValue([]),
      items: vi.fn().mockResolvedValue([]),
    };
    sut = new SpendReportService(query);
  });

  describe('level routing', () => {
    it('no selection → categories (L1), open to all tiers', async () => {
      query.categories.mockResolvedValue([
        { macroId: 'cat-groceries', amount: 75, lineCount: 10 },
        { macroId: null, amount: 25, lineCount: 2 },
      ]);
      const res = await sut.report(base, false, 'EUR');
      expect(res.level).toBe('categories');
      expect(res.total).toBe(100);
      expect(res.currency).toBe('EUR');
      expect(res.nodes[0]).toMatchObject({ id: 'cat-groceries', name: 'Groceries', amount: 75, pct: 75 });
      // null macro rolls up to the Uncategorized bucket.
      expect(res.nodes[1]).toMatchObject({ id: UNCATEGORIZED_ID, name: 'Uncategorized', pct: 25 });
    });

    it('categoryId only → merchants (L2), open to all tiers', async () => {
      query.merchants.mockResolvedValue([
        { merchantId: MID, merchantName: 'Jumbo', amount: 40, lineCount: 6, invoiceCount: 2, lastPurchasedOn: '2026-07-01' },
        { merchantId: null, merchantName: null, amount: 10, lineCount: 1, invoiceCount: 1, lastPurchasedOn: null },
      ]);
      const res = await sut.report({ ...base, categoryId: 'cat-groceries' }, false, 'EUR');
      expect(res.level).toBe('merchants');
      expect(query.merchants).toHaveBeenCalledWith('cat-groceries', expect.objectContaining({ country: 'NL', region: 'NL-NB' }));
      expect(res.categoryName).toBe('Groceries');
      expect(res.nodes[1]).toMatchObject({ id: UNKNOWN_MERCHANT_ID, name: 'Unknown merchant', invoiceCount: 1 });
    });

    it('categoryId + merchantId → item-categories (L3) for premium', async () => {
      query.itemCategories.mockResolvedValue([{ categoryId: 'cat-dairy', amount: 20, lineCount: 3 }]);
      const res = await sut.report({ ...base, categoryId: 'cat-groceries', merchantId: MID }, true, 'EUR');
      expect(res.level).toBe('item-categories');
      expect(res.nodes[0]).toMatchObject({ id: 'cat-dairy', name: 'Dairy & Eggs', pct: 100 });
    });

    it('categoryId + merchantId + itemCategoryId → items (L4) for premium', async () => {
      query.items.mockResolvedValue([
        {
          groupKey: 'p1', name: 'Milk 1L', quantity: 3, amount: 4.5, lineCount: 3,
          occurrences: [{ date: '2026-07-01', invoiceId: 'i1', quantity: 1, amount: 1.5 }],
        },
      ]);
      const res = await sut.report(
        { ...base, categoryId: 'cat-groceries', merchantId: MID, itemCategoryId: 'cat-dairy' },
        true,
        'EUR',
      );
      expect(res.level).toBe('items');
      expect(query.items).toHaveBeenCalledWith(MID, 'cat-dairy', expect.anything());
      expect(res.nodes[0]).toMatchObject({ id: 'p1', name: 'Milk 1L', quantity: 3, amount: 4.5 });
      expect(res.nodes[0].occurrences).toHaveLength(1);
    });

    it('resolves the UNKNOWN_MERCHANT_ID sentinel without a UUID check', async () => {
      await expect(
        sut.report({ ...base, categoryId: 'cat-groceries', merchantId: UNKNOWN_MERCHANT_ID }, true, 'EUR'),
      ).resolves.toMatchObject({ level: 'item-categories' });
      expect(query.itemCategories).toHaveBeenCalledWith('cat-groceries', UNKNOWN_MERCHANT_ID, expect.anything());
    });
  });

  describe('premium gating', () => {
    it('STANDARD drilling into a merchant (category + merchant) is rejected', async () => {
      await expect(
        sut.report({ ...base, categoryId: 'cat-groceries', merchantId: MID }, false, 'EUR'),
      ).rejects.toBeInstanceOf(PremiumRequiredError);
      expect(query.itemCategories).not.toHaveBeenCalled();
    });

    it('STANDARD can reach category and merchant levels', async () => {
      await expect(sut.report(base, false, 'EUR')).resolves.toMatchObject({ level: 'categories' });
      await expect(sut.report({ ...base, categoryId: 'cat-groceries' }, false, 'EUR')).resolves.toMatchObject({
        level: 'merchants',
      });
    });

    it('a bare merchantId without a category is NOT gated — it resolves to the open categories level', async () => {
      // Without categoryId the level is categories (merchantId ignored), so gating it would be a false 403.
      const res = await sut.report({ ...base, merchantId: MID }, false, 'EUR');
      expect(res.level).toBe('categories');
      expect(query.categories).toHaveBeenCalled();
    });

    it('TESTER and ADMIN reach item levels (elevated roles have premium access)', async () => {
      // isPremium is resolved by the route; the service trusts the flag. Passing true here mirrors that.
      await expect(
        sut.report({ ...base, categoryId: 'cat-groceries', merchantId: MID }, true, 'EUR'),
      ).resolves.toMatchObject({ level: 'item-categories' });
    });
  });

  describe('input validation', () => {
    it('rejects a malformed merchantId as a 400 (not a 500 from the ::uuid cast)', async () => {
      await expect(
        sut.report({ ...base, categoryId: 'cat-groceries', merchantId: 'not-a-uuid' }, true, 'EUR'),
      ).rejects.toBeInstanceOf(InvalidSpendReportQueryError);
      expect(query.itemCategories).not.toHaveBeenCalled();
    });

    it('propagates the 90-day cap as an InvalidSpendReportQueryError', async () => {
      await expect(
        sut.report({ ...base, preset: 'CUSTOM', from: '2026-01-01', to: '2026-06-30' }, true, 'EUR'),
      ).rejects.toBeInstanceOf(InvalidSpendReportQueryError);
    });
  });

  describe('share math', () => {
    it('a net-zero total yields 0% shares instead of NaN', async () => {
      query.categories.mockResolvedValue([
        { macroId: 'cat-groceries', amount: 10, lineCount: 1 },
        { macroId: 'cat-groceries-discount', amount: -10, lineCount: 1 },
      ]);
      const res = await sut.report(base, false, 'EUR');
      expect(res.total).toBe(0);
      expect(res.nodes.every((n) => n.pct === 0)).toBe(true);
    });
  });
});
