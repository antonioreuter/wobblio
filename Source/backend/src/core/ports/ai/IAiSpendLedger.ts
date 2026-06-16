export interface AiSpendRecord {
  tenantId: string;
  date: string;
  modelRole: string;
  inputTokens: number;
  outputTokens: number;
  estCost: number;
}

export interface IAiSpendLedger {
  record(entry: AiSpendRecord): Promise<void>;
  getDailyTotal(tenantId: string, date: string): Promise<number>;
}
