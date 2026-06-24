import type { IBusinessKpiSource } from '@core/ports/observability/IBusinessKpiSource';
import type { IKpiDailyWriter } from '@core/ports/observability/IKpiDailyWriter';
import {
  toBusinessKpiRows,
  toNewMerchantRows,
  toInvoicesByRegionRows,
  toUserCountryRows,
  toInvoiceCountryRows,
} from '@core/domain/businessKpis';

// Rolls one day's cross-tenant business + operational KPIs into kpi_daily (Epic 15):
// registrations, DAU/MAU, premium, conversion, MRR proxy, feedback (score + up/down
// counts), invoices processed/failed, new products, and new merchants per country.
export class BusinessKpiRollupService {
  constructor(
    private readonly source: IBusinessKpiSource,
    private readonly kpiWriter: IKpiDailyWriter,
  ) {}

  async run(metricDate: string): Promise<{ rowsWritten: number }> {
    const [snapshot, merchantsByCountry, invoicesByRegion, usersByCountry, invoicesByCountry] =
      await Promise.all([
        this.source.getSnapshot(metricDate),
        this.source.getNewMerchantsByCountry(metricDate),
        this.source.getInvoicesByRegion(metricDate),
        this.source.getUserKpisByCountry(metricDate),
        this.source.getInvoiceKpisByCountry(metricDate),
      ]);
    const rows = [
      ...toBusinessKpiRows(metricDate, snapshot),
      ...toNewMerchantRows(metricDate, merchantsByCountry),
      ...toInvoicesByRegionRows(metricDate, invoicesByRegion),
      ...toUserCountryRows(metricDate, usersByCountry),
      ...toInvoiceCountryRows(metricDate, invoicesByCountry),
    ];
    await this.kpiWriter.upsert(rows);
    return { rowsWritten: rows.length };
  }
}
