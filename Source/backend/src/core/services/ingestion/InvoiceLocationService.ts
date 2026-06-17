import type { IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import type { IRegionReference } from '../../ports/data-intelligence/IRegionReference';
import type { IContributorContextRepository } from '../../ports/data-intelligence/IContributorContextRepository';
import type { IPriceObservationStore } from '../../ports/data-intelligence/IPriceObservationStore';
import { buildPriceObservations } from '../../domain/priceObservation';
import { resolveObservationRegion, type InvoiceLocationStatus } from '../../domain/region';
import { isLocationConfirmable } from '../../domain/ingestion';
import {
  InvoiceNotFoundError,
  InvalidLocationError,
  LocationAlreadySetError,
  LocationNotConfirmableError,
} from '../../domain/errors';

export interface ConfirmLocationCommand {
  countryCode: string;
  regionCode: string;
}

// User-driven half of the location quality gate (§6.5). An invoice held PENDING at
// ingestion gets its location set exactly once here. When the supplied location maps
// to reference data, the deferred price observations are emitted now; an unmapped area
// is stored and HELD until the reference tables cover it.
export class InvoiceLocationService {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly regionReference: IRegionReference,
    private readonly contributorContext: IContributorContextRepository,
    private readonly priceObservationStore: IPriceObservationStore,
  ) {}

  async confirm(
    invoiceId: string,
    tenantId: string,
    command: ConfirmLocationCommand,
  ): Promise<InvoiceLocationStatus> {
    const invoice = await this.invoiceRepo.getById(invoiceId);
    if (!invoice) throw new InvoiceNotFoundError(invoiceId);
    // A duplicate/in-flight/failed invoice can sit at location_status='PENDING' but its
    // prices must never be shared — gate on the parse status before anything else so
    // emission (and a worker-clobbered stuck state) can't happen.
    if (!isLocationConfirmable(invoice.status)) {
      throw new LocationNotConfirmableError(invoiceId, invoice.status);
    }
    if (invoice.locationStatus !== 'PENDING' || invoice.locationConfirmedAt !== null) {
      throw new LocationAlreadySetError(invoiceId);
    }

    const countryCode = command.countryCode.trim().toUpperCase();
    if (countryCode.length !== 2) throw new InvalidLocationError('country must be a 2-letter code');

    const regionCode = resolveObservationRegion(command.regionCode, countryCode);
    const mapped = await this.regionReference.isMappedLocation(countryCode, regionCode);
    const status: InvoiceLocationStatus = mapped ? 'RESOLVED' : 'HELD_UNMAPPED';

    await this.invoiceRepo.confirmLocation({ invoiceId, countryCode, regionCode, status, source: 'USER' });

    if (status === 'RESOLVED') {
      await this.emitDeferredObservations(invoiceId, tenantId, countryCode, regionCode);
    }
    return status;
  }

  private async emitDeferredObservations(
    invoiceId: string,
    tenantId: string,
    countryCode: string,
    regionCode: string,
  ): Promise<void> {
    const reEmission = await this.invoiceRepo.getForReEmission(invoiceId);
    if (!reEmission) return;

    const context = await this.contributorContext.getContext(tenantId);
    const rows = buildPriceObservations({
      merchantId: reEmission.merchantId,
      merchantProvisional: reEmission.merchantProvisional,
      transactionDate: reEmission.transactionDate,
      currency: reEmission.currency,
      lines: reEmission.lines,
      context: { optedOut: context.optedOut, regionCode, countryCode, trustScore: context.trustScore },
    });
    if (rows.length > 0) await this.priceObservationStore.emit(rows);
  }
}
