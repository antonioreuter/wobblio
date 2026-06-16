import type { PriceObservationInput } from '@core/domain/priceObservation';

// §6.5 Price Observation Store (global, RLS-exempt by design). Rows carry NO
// tenant/user/household/invoice reference and NO tags — keep it that way.
export interface IPriceObservationStore {
  emit(rows: PriceObservationInput[]): Promise<void>;
}
