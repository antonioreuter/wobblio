import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { BudgetRecyclerService } from '@core/services/budgets/BudgetRecyclerService';
import type { IBudgetRecyclerRepository, ActiveBudget } from '@core/ports/budgets/IBudgetRecyclerRepository';
import type { INotificationRepository } from '@core/ports/notifications/INotificationRepository';
import type { IPushNotifier } from '@core/ports/notifications/IPushNotifier';

const budget = (over: Partial<ActiveBudget> = {}): ActiveBudget => ({
  id: 'b1',
  tenantId: 't1',
  scope: 'TOTAL',
  categoryId: null,
  memberUserId: null,
  amount: 100,
  period: 'MONTH',
  accumulated: 0,
  alert85Fired: false,
  alert100Fired: false,
  alert85At: null,
  alert100At: null,
  cycleStart: '2026-06-01',
  language: 'en',
  currency: 'EUR',
  ...over,
});

describe('BudgetRecyclerService', () => {
  let budgets: MockedObject<IBudgetRecyclerRepository>;
  let notifications: MockedObject<INotificationRepository>;
  let push: MockedObject<IPushNotifier>;
  let sut: BudgetRecyclerService;

  beforeEach(() => {
    budgets = {
      listAllActive: vi.fn().mockResolvedValue([]),
      listActiveForInvoice: vi.fn().mockResolvedValue([]),
      listActiveForTenant: vi.fn().mockResolvedValue([]),
      computeSpend: vi.fn().mockResolvedValue(0),
      saveState: vi.fn(),
    };
    notifications = { create: vi.fn(), listActive: vi.fn(), markRead: vi.fn(), purgeExpired: vi.fn().mockResolvedValue(0) };
    push = { push: vi.fn() };
    sut = new BudgetRecyclerService(budgets, notifications, push);
  });

  it('purges expired notifications and reports the processed count', async () => {
    budgets.listAllActive.mockResolvedValue([budget(), budget({ id: 'b2' })]);

    const outcome = await sut.run('2026-06-10');

    expect(outcome.processed).toBe(2);
    expect(notifications.purgeExpired).toHaveBeenCalledTimes(1);
  });

  it('fires the 85% alert once and persists the flag', async () => {
    budgets.listAllActive.mockResolvedValue([budget()]);
    budgets.computeSpend.mockResolvedValue(90);

    const outcome = await sut.run('2026-06-10');

    expect(outcome.alertsFired).toBe(1);
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', kind: 'BUDGET_85', budgetId: 'b1', ttlDays: 3 }),
    );
    expect(push.push).toHaveBeenCalledTimes(1);
    expect(budgets.saveState).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ accumulated: 90, alert85Fired: true, alert100Fired: false, cycleStart: '2026-06-01' }),
    );
  });

  it('fires both thresholds when spend jumps past 100%', async () => {
    budgets.listAllActive.mockResolvedValue([budget()]);
    budgets.computeSpend.mockResolvedValue(120);

    const outcome = await sut.run('2026-06-10');

    expect(outcome.alertsFired).toBe(2);
    const kinds = notifications.create.mock.calls.map(c => c[0].kind);
    expect(kinds).toEqual(['BUDGET_85', 'BUDGET_100']);
  });

  it('does not re-fire an alert whose flag is already set', async () => {
    budgets.listAllActive.mockResolvedValue([budget({ alert85Fired: true })]);
    budgets.computeSpend.mockResolvedValue(90); // ≥85% but <100%

    const outcome = await sut.run('2026-06-10');

    expect(outcome.alertsFired).toBe(0);
    expect(notifications.create).not.toHaveBeenCalled();
    expect(budgets.saveState).toHaveBeenCalledWith('b1', expect.objectContaining({ accumulated: 90 }));
  });

  it('does not re-fire when both thresholds have already fired', async () => {
    budgets.listAllActive.mockResolvedValue([budget({ alert85Fired: true, alert100Fired: true })]);
    budgets.computeSpend.mockResolvedValue(120);

    const outcome = await sut.run('2026-06-10');

    expect(outcome.alertsFired).toBe(0);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  describe('evaluateForInvoice', () => {
    it('evaluates only the invoice-affected budgets and never purges', async () => {
      budgets.listActiveForInvoice.mockResolvedValue([budget()]);
      budgets.computeSpend.mockResolvedValue(90);

      const outcome = await sut.evaluateForInvoice('inv-1', '2026-06-10');

      expect(budgets.listActiveForInvoice).toHaveBeenCalledWith('inv-1');
      expect(budgets.listAllActive).not.toHaveBeenCalled();
      expect(notifications.purgeExpired).not.toHaveBeenCalled();
      expect(outcome).toEqual({ processed: 1, alertsFired: 1 });
      expect(push.push).toHaveBeenCalledTimes(1);
    });

    it('fires 85% then 100% across two uploads, then nothing', async () => {
      // First upload crosses 85%.
      budgets.listActiveForInvoice.mockResolvedValue([budget()]);
      budgets.computeSpend.mockResolvedValue(90);
      expect((await sut.evaluateForInvoice('inv-1', '2026-06-10')).alertsFired).toBe(1);

      // Second upload crosses 100% (85 flag already set on the row).
      budgets.listActiveForInvoice.mockResolvedValue([budget({ alert85Fired: true, alert85At: 'x' })]);
      budgets.computeSpend.mockResolvedValue(120);
      expect((await sut.evaluateForInvoice('inv-2', '2026-06-11')).alertsFired).toBe(1);

      // Third upload, both already fired → silent.
      budgets.listActiveForInvoice.mockResolvedValue([budget({ alert85Fired: true, alert100Fired: true })]);
      budgets.computeSpend.mockResolvedValue(150);
      expect((await sut.evaluateForInvoice('inv-3', '2026-06-12')).alertsFired).toBe(0);

      const kinds = notifications.create.mock.calls.map(c => c[0].kind);
      expect(kinds).toEqual(['BUDGET_85', 'BUDGET_100']);
    });
  });

  describe('evaluateForTenant', () => {
    it('evaluates the tenant budgets and fires a crossed threshold', async () => {
      budgets.listActiveForTenant.mockResolvedValue([budget()]);
      budgets.computeSpend.mockResolvedValue(90);

      const outcome = await sut.evaluateForTenant('t1', '2026-06-10');

      expect(budgets.listActiveForTenant).toHaveBeenCalledWith('t1');
      expect(outcome).toEqual({ processed: 1, alertsFired: 1 });
    });

    it('never notifies more than twice (85% + 100%) within the same period', async () => {
      // First create/edit pushes past 100% → fires 85% and 100% (two).
      budgets.listActiveForTenant.mockResolvedValue([budget()]);
      budgets.computeSpend.mockResolvedValue(130);
      const first = await sut.evaluateForTenant('t1', '2026-06-10');

      // A later edit in the same period (both flags already set) → fires nothing.
      budgets.listActiveForTenant.mockResolvedValue([budget({ alert85Fired: true, alert100Fired: true })]);
      const second = await sut.evaluateForTenant('t1', '2026-06-10');

      expect(first.alertsFired).toBe(2);
      expect(second.alertsFired).toBe(0);
      expect(notifications.create).toHaveBeenCalledTimes(2);
      const kinds = notifications.create.mock.calls.map(c => c[0].kind);
      expect(kinds).toEqual(['BUDGET_85', 'BUDGET_100']);
    });
  });

  it('rolls a closed period over, clearing flags and recomputing the new window', async () => {
    budgets.listAllActive.mockResolvedValue([
      budget({ cycleStart: '2026-04-01', alert85Fired: true, alert100Fired: true }),
    ]);
    budgets.computeSpend.mockResolvedValue(30);

    await sut.run('2026-06-10');

    expect(budgets.computeSpend).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-06-01', to: '2026-07-01' }),
    );
    expect(budgets.saveState).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ cycleStart: '2026-06-01', alert85Fired: false, alert100Fired: false, accumulated: 30 }),
    );
    expect(notifications.create).not.toHaveBeenCalled();
  });
});
