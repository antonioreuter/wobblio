import type {
  IBudgetRecyclerRepository,
  ActiveBudget,
  BudgetState,
} from '../../ports/budgets/IBudgetRecyclerRepository';
import type { INotificationRepository } from '../../ports/notifications/INotificationRepository';
import type { IPushNotifier } from '../../ports/notifications/IPushNotifier';
import {
  advanceCycleStart,
  periodEnd,
  buildBudgetAlert,
  ALERT_85_RATIO,
  NOTIFICATION_TTL_DAYS,
  type AlertKind,
} from '../../domain/budget';

export interface RecyclerOutcome {
  processed: number;
  alertsFired: number;
}

// Nightly EventBridge cron (§10). Recomputes accumulation per active budget,
// fires 85%/100% alerts once each, rolls periods over, and purges expired
// notifications. Backdated invoices in a closed period never re-fire because each
// run only sums the current window.
export class BudgetRecyclerService {
  constructor(
    private readonly budgets: IBudgetRecyclerRepository,
    private readonly notifications: INotificationRepository,
    private readonly push: IPushNotifier,
  ) {}

  async run(today: string): Promise<RecyclerOutcome> {
    const all = await this.budgets.listAllActive();
    let alertsFired = 0;
    for (const budget of all) {
      alertsFired += await this.reconcile(budget, today);
    }
    await this.notifications.purgeExpired();
    return { processed: all.length, alertsFired };
  }

  private async reconcile(budget: ActiveBudget, today: string): Promise<number> {
    const state = this.rollOver(budget, today);
    state.accumulated = await this.budgets.computeSpend({
      tenantId: budget.tenantId,
      scope: budget.scope,
      categoryId: budget.categoryId,
      memberUserId: budget.memberUserId,
      from: state.cycleStart,
      to: periodEnd(state.cycleStart, budget.period),
    });

    const fired = await this.fireAlerts(budget, state);
    await this.budgets.saveState(budget.id, state);
    return fired;
  }

  // Reset accumulation + alert flags when the period rolled into a new cycle.
  private rollOver(budget: ActiveBudget, today: string): BudgetState {
    const cycleStart = advanceCycleStart(budget.cycleStart, budget.period, today);
    const rolled = cycleStart !== budget.cycleStart;
    return {
      accumulated: 0,
      cycleStart,
      alert85Fired: rolled ? false : budget.alert85Fired,
      alert85At: rolled ? null : budget.alert85At,
      alert100Fired: rolled ? false : budget.alert100Fired,
      alert100At: rolled ? null : budget.alert100At,
    };
  }

  // 85% and 100% are independent one-shot thresholds (no re-fire until rollover).
  private async fireAlerts(budget: ActiveBudget, state: BudgetState): Promise<number> {
    let fired = 0;
    const now = new Date().toISOString();

    if (!state.alert85Fired && state.accumulated >= ALERT_85_RATIO * budget.amount) {
      state.alert85Fired = true;
      state.alert85At = now;
      await this.emit(budget, 'BUDGET_85', state.accumulated);
      fired++;
    }
    if (!state.alert100Fired && state.accumulated >= budget.amount) {
      state.alert100Fired = true;
      state.alert100At = now;
      await this.emit(budget, 'BUDGET_100', state.accumulated);
      fired++;
    }
    return fired;
  }

  private async emit(budget: ActiveBudget, kind: AlertKind, accumulated: number): Promise<void> {
    const { title, body } = buildBudgetAlert(
      kind,
      budget.scope,
      budget.amount,
      accumulated,
      budget.language,
      budget.currency,
    );
    await this.notifications.create({
      tenantId: budget.tenantId,
      kind,
      title,
      body,
      budgetId: budget.id,
      ttlDays: NOTIFICATION_TTL_DAYS,
    });
    await this.push.push(budget.tenantId, title, body);
  }
}
