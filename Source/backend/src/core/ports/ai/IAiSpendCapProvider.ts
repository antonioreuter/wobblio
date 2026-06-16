export interface IAiSpendCapProvider {
  getDailyCapEur(): Promise<number>;
}
