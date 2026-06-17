import type { IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import type { IContributorContextRepository } from '../../ports/data-intelligence/IContributorContextRepository';
import type { IPriceObservationStore } from '../../ports/data-intelligence/IPriceObservationStore';
import type { ReleasableHeldInvoice } from '../../ports/ingestion/IReleasableHeldInvoiceReader';
import { buildPriceObservations } from '../../domain/priceObservation';

// Releases a single HELD_UNMAPPED invoice whose region is now mapped (§6.5): rebuild
// the deferred observations from the persisted lines and the invoice's stored location,
// emit them, and flip the invoice to RESOLVED. The caller (cron handler) owns the
// per-invoice transaction and has already set this invoice's tenant context, so the
// RLS-scoped reads/writes below resolve to the right tenant.
export class HeldInvoiceReleaseService {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly contributorContext: IContributorContextRepository,
    private readonly priceObservationStore: IPriceObservationStore,
  ) {}

  async releaseInvoice(candidate: ReleasableHeldInvoice): Promise<boolean> {
    const reEmission = await this.invoiceRepo.getForReEmission(candidate.invoiceId);
    if (!reEmission) {
      await this.invoiceRepo.markLocationResolved(candidate.invoiceId);
      return false;
    }

    const context = await this.contributorContext.getContext(candidate.tenantId);
    const rows = buildPriceObservations({
      merchantId: reEmission.merchantId,
      merchantProvisional: reEmission.merchantProvisional,
      transactionDate: reEmission.transactionDate,
      currency: reEmission.currency,
      lines: reEmission.lines,
      context: {
        optedOut: context.optedOut,
        regionCode: candidate.regionCode,
        countryCode: candidate.countryCode,
        trustScore: context.trustScore,
      },
    });
    if (rows.length > 0) await this.priceObservationStore.emit(rows);

    await this.invoiceRepo.markLocationResolved(candidate.invoiceId);
    return rows.length > 0;
  }
}
