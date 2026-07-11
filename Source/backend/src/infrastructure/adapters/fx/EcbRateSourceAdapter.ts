import type { EcbDailyRates, IEcbRateSource } from '@core/ports/fx/IEcbRateSource';

const ECB_DAILY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
// ECB serves attributes single-quoted in the daily file but double-quoted in the 90-day history
// file, so accept either quote style rather than assume one.
const DATE_RE = /time=["'](\d{4}-\d{2}-\d{2})["']/;
const RATE_RE = /currency=["']([A-Z]{3})["']\s+rate=["']([\d.]+)["']/g;

// Fetches the ECB daily reference rates (free, no key). The document is a small, stable XML with
// one <Cube time=...> and a flat list of <Cube currency=.. rate=../> — parsed by regex to avoid
// pulling in an XML dependency for a fixed format.
export class EcbRateSourceAdapter implements IEcbRateSource {
  async fetchDaily(): Promise<EcbDailyRates> {
    const response = await fetch(ECB_DAILY_URL);
    if (!response.ok) throw new Error(`ECB fetch failed: HTTP ${response.status}`);
    const xml = await response.text();

    const dateMatch = DATE_RE.exec(xml);
    if (!dateMatch) throw new Error('ECB response missing reference date');

    const rows: { quote: string; rate: number }[] = [];
    for (const match of xml.matchAll(RATE_RE)) {
      const rate = Number(match[2]);
      if (Number.isFinite(rate) && rate > 0) rows.push({ quote: match[1], rate });
    }
    if (rows.length === 0) throw new Error('ECB response contained no rates');

    return { date: dateMatch[1], rows };
  }
}
