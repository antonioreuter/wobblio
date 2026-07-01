// Fetches the ECB daily reference rates (EUR-base). Keeps HTTP + XML parsing out of core.
export interface EcbDailyRates {
  date: string; // ISO YYYY-MM-DD, the ECB publication date
  rows: { quote: string; rate: number }[];
}

export interface IEcbRateSource {
  fetchDaily(): Promise<EcbDailyRates>;
}
