// Region resolution for a price observation. Regions are ISO 3166-2 subnational
// codes (e.g. 'NL-NB', 'US-CA'), country-qualified by construction so they never
// collide across countries in the RLS-exempt price_observation store.
//
// Prefer the supplied region; fall back to the country code when none is set. Used by
// InvoiceLocationService.confirm (user-supplied region) and the observation builder
// for the contributor's home region. The worker now resolves a per-invoice region via
// resolveIngestionLocation below, so this is the country-fallback safety net.
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

// Where the invoice location came from. Resolved at ingestion from the printed
// receipt address (RECEIPT — the only tier that auto-resolves), the browser upload
// geolocation (GEO), or the contributor profile (PROFILE); or set later by the user
// confirming the gate (USER). COUNTRY_WITH_PROFILE_REGION is an internal tag for
// invoices where receipt country matched the profile but the region came from profile.
export type LocationSource = 'PROFILE' | 'USER' | 'RECEIPT' | 'GEO' | 'COUNTRY_WITH_PROFILE_REGION';

// A country-qualified location candidate. countryCode is always known (the profile
// always has one); regionCode is null until it maps to an ISO 3166-2 subdivision.
export interface LocationCandidate {
  countryCode: string;
  regionCode: string | null;
}

export interface IngestionLocationInput {
  receipt: { countryCode: string | null; regionCode: string | null };
  uploadGeo: LocationCandidate | null;
  profile: LocationCandidate;
}

export interface ResolvedIngestionLocation extends LocationCandidate {
  status: InvoiceLocationStatus;
  source: LocationSource;
}

// Single decision point for an invoice's sharing location (§6.5). Three-step fallback:
// 1. Receipt with country + region → RESOLVED (RECEIPT source)
// 2. Receipt country only, matches profile country, profile has region → RESOLVED (COUNTRY_WITH_PROFILE_REGION source)
// 3. Else → PENDING (GEO or PROFILE source, user must confirm)
export function resolveIngestionLocation(input: IngestionLocationInput): ResolvedIngestionLocation {
  const { receipt, uploadGeo, profile } = input;

  // Step 1: Receipt with both country and region → auto-resolve
  if (receipt.countryCode && receipt.regionCode) {
    return { countryCode: receipt.countryCode, regionCode: receipt.regionCode, status: 'RESOLVED', source: 'RECEIPT' };
  }

  // Step 2: Receipt country only, and it matches profile country, and profile has region
  if (receipt.countryCode && receipt.countryCode === profile.countryCode && profile.regionCode) {
    return { countryCode: receipt.countryCode, regionCode: profile.regionCode, status: 'RESOLVED', source: 'COUNTRY_WITH_PROFILE_REGION' };
  }

  // Step 3: Else → PENDING (prefer GEO over PROFILE)
  if (uploadGeo) {
    return { countryCode: uploadGeo.countryCode, regionCode: uploadGeo.regionCode, status: 'PENDING', source: 'GEO' };
  }
  return { countryCode: profile.countryCode, regionCode: profile.regionCode, status: 'PENDING', source: 'PROFILE' };
}
