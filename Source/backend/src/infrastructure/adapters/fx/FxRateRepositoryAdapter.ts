import type { Pool, PoolClient } from 'pg';
import type { IFxRateRepository } from '@core/ports/fx/IFxRateRepository';

// fx_rate is a global, RLS-exempt reference table (like price_observation) — no SET LOCAL,
// no tenant column. EUR-base rows only; cross-rates are derived in the harmonization service.
export class FxRateRepositoryAdapter implements IFxRateRepository {
  constructor(private readonly db: Pool | PoolClient) {}

  async upsertDaily(date: string, base: string, rows: { quote: string; rate: number }[]): Promise<number> {
    let written = 0;
    for (const row of rows) {
      const result = await this.db.query(
        `INSERT INTO fx_rate (date, base, quote, rate)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (date, base, quote) DO UPDATE SET rate = EXCLUDED.rate`,
        [date, base, row.quote, row.rate],
      );
      written += result.rowCount ?? 0;
    }
    return written;
  }

  async latestOnOrBefore(quote: string, onDate: string): Promise<number | null> {
    if (quote === 'EUR') return 1;
    const result = await this.db.query<{ rate: string }>(
      `SELECT rate FROM fx_rate
       WHERE base = 'EUR' AND quote = $1 AND date <= $2
       ORDER BY date DESC LIMIT 1`,
      [quote, onDate],
    );
    const row = result.rows[0];
    return row ? Number(row.rate) : null;
  }
}
