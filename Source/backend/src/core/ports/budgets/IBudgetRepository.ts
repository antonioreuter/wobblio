import type { BudgetScope, BudgetPeriod } from '@core/domain/budget';

export interface CreateBudgetInput {
  tenantId: string;
  scope: BudgetScope;
  categoryId: string | null;
  memberUserId: string | null;
  amount: number;
  period: BudgetPeriod;
}

export interface BudgetPatch {
  amount?: number;
  period?: BudgetPeriod;
}

export interface BudgetView {
  id: string;
  scope: BudgetScope;
  categoryId: string | null;
  memberUserId: string | null;
  amount: number;
  period: BudgetPeriod;
  accumulated: number;
  alert85Fired: boolean;
  alert100Fired: boolean;
  alert85At: string | null;
  alert100At: string | null;
  cycleStart: string;
}

export interface IBudgetRepository {
  create(input: CreateBudgetInput): Promise<string>;
  countForTenant(): Promise<number>;
  listForTenant(): Promise<BudgetView[]>;
  get(budgetId: string): Promise<BudgetView | null>;
  // Returns false when no row matched (unknown id or cross-tenant via RLS).
  update(budgetId: string, patch: BudgetPatch): Promise<boolean>;
  remove(budgetId: string): Promise<boolean>;
}
