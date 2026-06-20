import type { BudgetScope, BudgetPeriod } from '@core/domain/budget';

// Cross-tenant view of one budget (the nightly recycler iterates every tenant).
export interface ActiveBudget {
  id: string;
  tenantId: string;
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
  language: string;
  currency: string;
}

export interface ComputeSpendInput {
  tenantId: string;
  scope: BudgetScope;
  categoryId: string | null;
  memberUserId: string | null;
  from: string; // inclusive ISO date
  to: string;   // exclusive ISO date
}

export interface BudgetState {
  accumulated: number;
  cycleStart: string;
  alert85Fired: boolean;
  alert85At: string | null;
  alert100Fired: boolean;
  alert100At: string | null;
}

export interface IBudgetRecyclerRepository {
  listAllActive(): Promise<ActiveBudget[]>;
  // Only the budgets a single invoice can affect: the uploader's own budgets plus
  // the owner's budgets for the invoice's household.
  listActiveForInvoice(invoiceId: string): Promise<ActiveBudget[]>;
  // One tenant's active budgets (used to alert right after a budget is created/edited).
  listActiveForTenant(tenantId: string): Promise<ActiveBudget[]>;
  computeSpend(input: ComputeSpendInput): Promise<number>;
  saveState(budgetId: string, state: BudgetState): Promise<void>;
}
