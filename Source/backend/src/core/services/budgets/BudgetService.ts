import type {
  IBudgetRepository,
  BudgetPatch,
  BudgetView,
} from '../../ports/budgets/IBudgetRepository';
import type { IHouseholdRepository } from '../../ports/households/IHouseholdRepository';
import type { UserRole } from '../../ports/identity/IAppUserRepository';
import {
  MAX_BUDGETS_PER_TENANT,
  advanceCycleStart,
  periodEnd,
  type BudgetScope,
  type BudgetPeriod,
} from '../../domain/budget';
import { hasPremiumAccess } from '../../domain/access';
import {
  PremiumRequiredError,
  InvalidBudgetError,
  BudgetLimitError,
  BudgetNotFoundError,
  NotHouseholdOwnerError,
} from '../../domain/errors';

export interface NewBudget {
  scope: BudgetScope;
  categoryId: string | null;
  memberUserId: string | null;
  amount: number;
  period: BudgetPeriod;
}

const SCOPES: BudgetScope[] = ['TOTAL', 'CATEGORY', 'MEMBER', 'HOUSEHOLD'];
const PERIODS: BudgetPeriod[] = ['DAY', 'WEEK', 'MONTH'];

export class BudgetService {
  constructor(
    private readonly budgets: IBudgetRepository,
    private readonly households: IHouseholdRepository,
  ) {}

  async create(userId: string, role: UserRole, input: NewBudget): Promise<BudgetView> {
    if (!hasPremiumAccess(role)) throw new PremiumRequiredError('budgets');
    validateNewBudget(input);
    await this.authorizeCreate(userId, input);

    const count = await this.budgets.countForTenant();
    if (count >= MAX_BUDGETS_PER_TENANT) throw new BudgetLimitError(MAX_BUDGETS_PER_TENANT);

    const id = await this.budgets.create({ tenantId: userId, ...input });
    const view = await this.budgets.get(id);
    if (!view) throw new BudgetNotFoundError(id);
    return view;
  }

  // Budgets are owner-managed. A household member who is not the owner may create
  // no budgets; a solo user may create TOTAL/CATEGORY but not MEMBER/HOUSEHOLD (no
  // household to scope); an owner may create any scope, with MEMBER validated
  // against the roster.
  private async authorizeCreate(userId: string, input: NewBudget): Promise<void> {
    const membership = await this.households.findMembershipForUser(userId);
    if (membership && membership.ownerUserId !== userId) {
      throw new NotHouseholdOwnerError(membership.householdId);
    }
    if (input.scope === 'TOTAL' || input.scope === 'CATEGORY') return;
    if (!membership) throw new NotHouseholdOwnerError();
    if (input.scope === 'HOUSEHOLD') return;

    const members = await this.households.listMembers(membership.householdId);
    if (!members.some(member => member.userId === input.memberUserId)) {
      throw new InvalidBudgetError('member not in household');
    }
  }

  // Budget consumption is shown live: each budget's accumulated spend is recomputed
  // over the current period window on read, so an upload reflects immediately instead
  // of waiting for the nightly recycler. The stored column is only the cron's snapshot.
  async list(tenantId: string, today: string): Promise<BudgetView[]> {
    const budgets = await this.budgets.listForTenant();
    return Promise.all(budgets.map(budget => this.withLiveSpend(tenantId, today, budget)));
  }

  private async withLiveSpend(tenantId: string, today: string, budget: BudgetView): Promise<BudgetView> {
    const cycleStart = advanceCycleStart(budget.cycleStart, budget.period, today);
    const accumulated = await this.budgets.computeSpend({
      tenantId,
      scope: budget.scope,
      categoryId: budget.categoryId,
      memberUserId: budget.memberUserId,
      from: cycleStart,
      to: periodEnd(cycleStart, budget.period),
    });
    return { ...budget, accumulated, cycleStart };
  }

  async update(budgetId: string, patch: BudgetPatch): Promise<void> {
    validatePatch(patch);
    const updated = await this.budgets.update(budgetId, patch);
    if (!updated) throw new BudgetNotFoundError(budgetId);
  }

  async remove(budgetId: string): Promise<void> {
    const removed = await this.budgets.remove(budgetId);
    if (!removed) throw new BudgetNotFoundError(budgetId);
  }
}

function validateNewBudget(input: NewBudget): void {
  if (!SCOPES.includes(input.scope)) throw new InvalidBudgetError('unknown scope');
  if (!PERIODS.includes(input.period)) throw new InvalidBudgetError('unknown period');
  if (!(input.amount > 0)) throw new InvalidBudgetError('amount must be positive');
  if (input.scope === 'CATEGORY' && !input.categoryId) throw new InvalidBudgetError('categoryId required for CATEGORY scope');
  if (input.scope === 'MEMBER' && !input.memberUserId) throw new InvalidBudgetError('memberUserId required for MEMBER scope');
}

function validatePatch(patch: BudgetPatch): void {
  if (patch.amount !== undefined && !(patch.amount > 0)) throw new InvalidBudgetError('amount must be positive');
  if (patch.period !== undefined && !PERIODS.includes(patch.period)) throw new InvalidBudgetError('unknown period');
}
