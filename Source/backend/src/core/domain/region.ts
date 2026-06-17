// Region resolution for a price observation. Regions are ISO 3166-2 subnational
// codes (e.g. 'NL-NB', 'US-CA'), country-qualified by construction so they never
// collide across countries in the RLS-exempt price_observation store.
//
// Prefer the contributor's home region; fall back to the country code when none is
// set. Branch-location-derived region (from the merchant's resolved store address)
// is a future enhancement — the vision schema does not extract store addresses yet.
export function resolveObservationRegion(
  contributorRegion: string | null | undefined,
  countryCode: string,
): string {
  const region = contributorRegion?.trim();
  return region && region.length > 0 ? region : countryCode;
}

// Sharing gate for an invoice's price observations (§6.5). An invoice's prices
// reach the global index only once its location is RESOLVED (mapped to reference
// data). PENDING holds the prices and prompts the user; HELD_UNMAPPED holds them
// until the user-supplied area is added to the reference tables.
export type InvoiceLocationStatus = 'RESOLVED' | 'PENDING' | 'HELD_UNMAPPED';

// Where the invoice location came from: derived from the contributor profile at
// ingestion, or explicitly confirmed once by the user.
export type LocationSource = 'PROFILE' | 'USER';
